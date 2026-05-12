import { NextResponse } from 'next/server'
import { Pool } from 'pg'
import { getACSDataForZip, getCountyFipsForZip, getCBPDataForCounty, computeOpportunityScore } from '../../../../../lib/census.js'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const CENSUS_KEY = process.env.CENSUS_API_KEY || 'b35158bfd9e38593a6d0a5d2456fb2c25b3986ad'

export const dynamic = 'force-dynamic'

// ── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function extractZipFromAddress(address) {
  if (!address) return null
  const m = String(address).match(/\b(\d{5})(?:-\d{4})?\b/)
  return m ? m[1] : null
}

function generateSignals(data) {
  const signals = []

  if (data.medianHouseholdIncome > 100000) {
    signals.push({ type: 'positive', text: `Premium market — $${(data.medianHouseholdIncome / 1000).toFixed(0)}K median income` })
  } else if (data.medianHouseholdIncome < 60000) {
    signals.push({ type: 'warning', text: `Value market — $${(data.medianHouseholdIncome / 1000).toFixed(0)}K median income. Consider subsidy positioning.` })
  } else {
    signals.push({ type: 'info', text: `Mid-market — $${(data.medianHouseholdIncome / 1000).toFixed(0)}K median income` })
  }

  if (data.childrenUnder5 > 8000) {
    signals.push({ type: 'positive', text: `Large market — ${data.childrenUnder5.toLocaleString()} children under 5 in ZIP` })
  } else if (data.childrenUnder5 < 2000) {
    signals.push({ type: 'warning', text: `Small market — only ${data.childrenUnder5.toLocaleString()} children under 5 in ZIP. Market ceiling is low.` })
  }

  if (data.birthsPerCenter < 30) {
    signals.push({ type: 'warning', text: `Competitive market — ${Math.round(data.birthsPerCenter)} births per childcare center (national avg: ~60)` })
  } else if (data.birthsPerCenter > 60) {
    signals.push({ type: 'positive', text: `Underserved market — ${Math.round(data.birthsPerCenter)} births per center. Room to grow.` })
  }

  const spanishPct = data.totalPopulation > 0 ? (data.spanishSpeakingHouseholds / data.totalPopulation * 100) : 0
  if (spanishPct > 20) {
    signals.push({ type: 'info', text: `${spanishPct.toFixed(0)}% Spanish-speaking households — Spanish creative recommended` })
  }

  return signals
}

// ── Time-series Census fetchers ────────────────────────────────────────────

async function getPEPBirths(stateFips, countyFips, year) {
  try {
    const url =
      `https://api.census.gov/data/${year}/pep/components` +
      `?get=NAME,BIRTHS&for=county:${countyFips}&in=state:${stateFips}&key=${CENSUS_KEY}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (!data || data.length < 2) return null
    const idx    = data[0].indexOf('BIRTHS')
    const births = parseInt(data[1][idx])
    return births > 0 ? births : null
  } catch {
    return null
  }
}

async function getCBPByYear(stateFips, countyFips, year) {
  try {
    const url =
      `https://api.census.gov/data/${year}/cbp` +
      `?get=ESTAB&for=county:${countyFips}&in=state:${stateFips}&NAICS2017=6244&key=${CENSUS_KEY}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (!data || data.length < 2) return null
    const idx   = data[0].indexOf('ESTAB')
    const estab = parseInt(data[1][idx])
    return estab > 0 ? estab : null
  } catch {
    return null
  }
}

async function getACSChildrenByYear(zip, year) {
  try {
    const url =
      `https://api.census.gov/data/${year}/acs/acs5` +
      `?get=B09001_002E&for=zip%20code%20tabulation%20area:${zip}&key=${CENSUS_KEY}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (!data || data.length < 2) return null
    const idx   = data[0].indexOf('B09001_002E')
    const count = parseInt(data[1][idx])
    return count > 0 ? count : null
  } catch {
    return null
  }
}

async function buildTimeSeries(stateFips, countyFips, zip) {
  console.log(`[Demographics/TimeSeries] Building for county ${stateFips}-${countyFips}, ZIP ${zip}`)

  // PEP births 2012-2023 (sequential, rate-limited)
  const birthsData = []
  for (const year of [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023]) {
    const births = await getPEPBirths(stateFips, countyFips, year)
    if (births != null) birthsData.push({ year, births })
    await sleep(300)
  }

  // CBP childcare centers 2017-2023 (sequential, rate-limited)
  const centersData = []
  for (const year of [2017, 2018, 2019, 2020, 2021, 2022, 2023]) {
    const count = await getCBPByYear(stateFips, countyFips, year)
    if (count != null) centersData.push({ year, count })
    await sleep(300)
  }

  // ACS children under 5 by vintage year (sequential, rate-limited)
  const childrenData = []
  for (const year of [2018, 2019, 2020, 2021, 2022, 2023, 2024]) {
    const count = await getACSChildrenByYear(zip, year)
    if (count != null) childrenData.push({ year, count })
    await sleep(300)
  }

  // Children per center ratio (where both series overlap)
  const perCenterData = []
  for (const cu5 of childrenData) {
    const centerRow = centersData.find(c => c.year === cu5.year)
    if (centerRow && centerRow.count > 0) {
      perCenterData.push({
        year:  cu5.year,
        ratio: Math.round((cu5.count / centerRow.count) * 10) / 10,
      })
    }
  }

  console.log(`[Demographics/TimeSeries] Done — births:${birthsData.length} centers:${centersData.length} children:${childrenData.length}`)

  return {
    births:           birthsData,
    childcareCenters: centersData,
    childrenUnder5:   childrenData,
    childrenPerCenter: perCenterData,
  }
}

// ── DB migration ───────────────────────────────────────────────────────────

async function ensureMigrations() {
  try {
    await pool.query(`
      ALTER TABLE "ClientMarketIntelligence"
      ADD COLUMN IF NOT EXISTS "timeSeries" JSONB
    `)
  } catch (e) {
    // Column may already exist or table doesn't exist yet — non-fatal
    console.warn('[Demographics] Migration note:', e.message)
  }
}

// ── GET handler ────────────────────────────────────────────────────────────

export async function GET(req, { params }) {
  try {
    const { acronym } = await params
    const acr = acronym.toUpperCase()

    // Run migrations
    await ensureMigrations()

    // 1. Get GBP locations for this client
    const locRes = await pool.query(
      `SELECT id, "locationName", address, city, state,
              "liveDataSnapshot",
              "liveDataSnapshot"->'addressInfo' AS "addressInfo"
       FROM "GBPLocation"
       WHERE "clientAcronym" = $1 AND "isActive" = true
       ORDER BY "locationName" ASC`,
      [acr]
    )

    if (locRes.rows.length === 0) {
      return NextResponse.json({ locations: [], updatedAt: null })
    }

    // 2. Get tenant ID
    const tenantRes = await pool.query(
      `SELECT "tenantId" FROM "GBPLocation" WHERE "clientAcronym" = $1 LIMIT 1`,
      [acr]
    )
    const tenantId = tenantRes.rows[0]?.tenantId || acr

    const results = []

    for (const loc of locRes.rows) {
      const snap     = loc.liveDataSnapshot || {}
      const addrInfo = snap.addressInfo || {}

      // Extract ZIP
      const zip = addrInfo.zip || extractZipFromAddress(loc.address)
      const lat = snap.latitude  || null
      const lng = snap.longitude || null

      // Build full address string
      const city        = addrInfo.city   || loc.city  || ''
      const region      = addrInfo.region || loc.state || ''
      const fullAddress = [loc.address, city, region, zip].filter(Boolean).join(', ')

      if (!zip) {
        results.push({
          locationName: loc.locationName,
          address: fullAddress,
          zip: null,
          error: 'No ZIP code found for this location',
        })
        continue
      }

      // 3. Check stored data
      const storedRes = await pool.query(
        `SELECT * FROM "ClientMarketIntelligence"
         WHERE "tenantId" = $1 AND "gbpLocationId" = $2
         ORDER BY year DESC LIMIT 1`,
        [tenantId, loc.id]
      )

      let data     = null
      let syncedAt = null

      if (storedRes.rows.length > 0) {
        const row = storedRes.rows[0]
        data      = row
        syncedAt  = row.syncedAt

        // If timeSeries is missing, compute + backfill it now
        if (!data.timeSeries && data.stateFips && data.countyFips) {
          try {
            const ts = await buildTimeSeries(data.stateFips, data.countyFips, data.zip || zip)
            await pool.query(
              `UPDATE "ClientMarketIntelligence"
               SET "timeSeries" = $1
               WHERE "tenantId" = $2 AND "gbpLocationId" = $3`,
              [JSON.stringify(ts), tenantId, loc.id]
            )
            data = { ...row, timeSeries: ts }
          } catch (tsErr) {
            console.error(`[Demographics] TimeSeries backfill error for ${loc.locationName}:`, tsErr.message)
          }
        }
      } else {
        // 4. Fetch live from Census API
        try {
          const [acsData, fips] = await Promise.all([
            getACSDataForZip(zip),
            getCountyFipsForZip(zip),
          ])

          if (!acsData) {
            results.push({
              locationName: loc.locationName,
              address: fullAddress,
              zip,
              lat,
              lng,
              error: 'Census API returned no data for this ZIP',
            })
            continue
          }

          let cbpData = null
          if (fips) {
            cbpData = await getCBPDataForCounty(fips.stateFips, fips.countyFips)
          }

          const opportunityScore = computeOpportunityScore({
            childrenUnder5:       acsData.childrenUnder5,
            workingParentsUnder6: acsData.workingParentsUnder6,
            medianHouseholdIncome: acsData.medianHouseholdIncome,
            childcareCenterCount: cbpData?.childcareCenterCount || 0,
            birthsLastYear:       acsData.birthsLastYear,
          })

          const birthsPerCenter = cbpData?.childcareCenterCount > 0
            ? Math.round((acsData.birthsLastYear / cbpData.childcareCenterCount) * 10) / 10
            : null

          // Compute timeSeries if we have FIPS
          let timeSeries = null
          if (fips) {
            try {
              timeSeries = await buildTimeSeries(fips.stateFips, fips.countyFips, zip)
            } catch (tsErr) {
              console.error(`[Demographics] TimeSeries error for ${loc.locationName}:`, tsErr.message)
            }
          }

          const now = new Date().toISOString()

          // Store for future use
          await pool.query(
            `INSERT INTO "ClientMarketIntelligence"
               ("tenantId", "acronym", "gbpLocationId", "locationName", zip,
                "stateFips", "countyFips", "countyName", year,
                "totalPopulation", "childrenUnder5", "children5to9", "children10to14",
                "medianHouseholdIncome", "workingParentsUnder6", "belowPovertyLine",
                "spanishSpeakingHouseholds", "birthsLastYear",
                "childcareCenterCount", "childcareEmployment", "childcarePayrollK",
                "opportunityScore", "birthsPerCenter",
                lat, lng, "timeSeries", "syncedAt")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
             ON CONFLICT DO NOTHING`,
            [
              tenantId, acr, loc.id, loc.locationName, zip,
              fips?.stateFips || null, fips?.countyFips || null, cbpData?.countyName || null, 2024,
              acsData.totalPopulation, acsData.childrenUnder5, acsData.children5to9, acsData.children10to14,
              acsData.medianHouseholdIncome, acsData.workingParentsUnder6, acsData.belowPovertyLine,
              acsData.spanishSpeakingHouseholds, acsData.birthsLastYear,
              cbpData?.childcareCenterCount || null, cbpData?.childcareEmployment || null, cbpData?.childcarePayroll || null,
              opportunityScore, birthsPerCenter,
              lat, lng, timeSeries ? JSON.stringify(timeSeries) : null, now,
            ]
          )

          data = {
            zip,
            stateFips:              fips?.stateFips,
            countyFips:             fips?.countyFips,
            countyName:             cbpData?.countyName,
            year:                   2024,
            totalPopulation:        acsData.totalPopulation,
            childrenUnder5:         acsData.childrenUnder5,
            children5to9:           acsData.children5to9,
            children10to14:         acsData.children10to14,
            medianHouseholdIncome:  acsData.medianHouseholdIncome,
            workingParentsUnder6:   acsData.workingParentsUnder6,
            belowPovertyLine:       acsData.belowPovertyLine,
            spanishSpeakingHouseholds: acsData.spanishSpeakingHouseholds,
            birthsLastYear:         acsData.birthsLastYear,
            childcareCenterCount:   cbpData?.childcareCenterCount || 0,
            childcareEmployment:    cbpData?.childcareEmployment  || 0,
            opportunityScore,
            birthsPerCenter,
            timeSeries,
          }
          syncedAt = now
        } catch (fetchErr) {
          console.error(`[Demographics] Census fetch error for ZIP ${zip}:`, fetchErr.message)
          results.push({
            locationName: loc.locationName,
            address: fullAddress,
            zip,
            lat,
            lng,
            error: `Census fetch failed: ${fetchErr.message}`,
          })
          continue
        }
      }

      const birthsPerCenter = data.birthsPerCenter
        ? parseFloat(data.birthsPerCenter)
        : (data.childcareCenterCount > 0
            ? Math.round((data.birthsLastYear / data.childcareCenterCount) * 10) / 10
            : null)

      // Parse timeSeries if it came back as a string from PG
      let timeSeries = data.timeSeries
      if (typeof timeSeries === 'string') {
        try { timeSeries = JSON.parse(timeSeries) } catch { timeSeries = null }
      }

      const enriched = {
        locationName:             loc.locationName,
        address:                  fullAddress,
        zip:                      data.zip || zip,
        lat:                      lat || data.lat,
        lng:                      lng || data.lng,
        totalPopulation:          data.totalPopulation || 0,
        childrenUnder5:           data.childrenUnder5  || 0,
        children5to9:             data.children5to9    || 0,
        children10to14:           data.children10to14  || 0,
        medianHouseholdIncome:    data.medianHouseholdIncome    || 0,
        workingParentsUnder6:     data.workingParentsUnder6     || 0,
        belowPovertyLine:         data.belowPovertyLine         || 0,
        spanishSpeakingHouseholds: data.spanishSpeakingHouseholds || 0,
        birthsLastYear:           data.birthsLastYear           || 0,
        childcareCenterCount:     data.childcareCenterCount     || 0,
        childcareEmployment:      data.childcareEmployment      || 0,
        countyName:               data.countyName               || null,
        opportunityScore:         data.opportunityScore         || 0,
        birthsPerCenter,
        timeSeries:               timeSeries || null,
        syncedAt,
      }

      enriched.signals = generateSignals(enriched)

      results.push(enriched)
    }

    const latestSync = results
      .map(r => r.syncedAt)
      .filter(Boolean)
      .sort()
      .pop() || null

    return NextResponse.json({ locations: results, updatedAt: latestSync })
  } catch (e) {
    console.error('[Demographics API]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
