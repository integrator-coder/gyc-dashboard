#!/usr/bin/env node
/**
 * sync-dfseo-data.js
 * Pulls DataForSEO organic rank data for all active SEO clients and stores in:
 *   - ClientDFSEOSnapshot  (monthly historical + current organic metrics)
 *   - ClientDFSEOKeyword   (top ranked keywords, refreshed each run)
 *
 * Cost estimate: ~$0.002–0.15 per client (depending on keyword count)
 * Recommended cadence: monthly (cron 1st of month)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })

const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const DFSEO_LOGIN    = process.env.DATAFORSEO_LOGIN
const DFSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD
const AUTH = Buffer.from(`${DFSEO_LOGIN}:${DFSEO_PASSWORD}`).toString('base64')
const HEADERS = { 'Authorization': `Basic ${AUTH}`, 'Content-Type': 'application/json' }

// Extract clean domain from website URL
function extractDomain(website) {
  if (!website) return null
  try {
    let s = website.trim().toLowerCase()
    if (!s.startsWith('http')) s = 'https://' + s
    const u = new URL(s)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

async function dfseoPost(endpoint, body) {
  const r = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
  return r.json()
}

async function upsertSnapshot(acronym, domain, snapshotDate, metrics, type = 'monthly') {
  const m = metrics
  await pool.query(
    `INSERT INTO "ClientDFSEOSnapshot"
      ("clientAcronym","domain","snapshotDate","organicCount","organicEtv","organicValue",
       "pos1","pos2_3","pos4_10","pos11_20","pos21_100","isNew","isUp","isDown","isLost","snapshotType")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT ("clientAcronym","snapshotDate","snapshotType")
     DO UPDATE SET
       "organicCount"=$4,"organicEtv"=$5,"organicValue"=$6,
       "pos1"=$7,"pos2_3"=$8,"pos4_10"=$9,"pos11_20"=$10,"pos21_100"=$11,
       "isNew"=$12,"isUp"=$13,"isDown"=$14,"isLost"=$15`,
    [
      acronym, domain, snapshotDate,
      m.count, m.etv, m.estimated_paid_traffic_cost,
      m.pos_1, m.pos_2_3, m.pos_4_10, m.pos_11_20,
      (m.pos_21_30 || 0) + (m.pos_31_40 || 0) + (m.pos_41_50 || 0) +
      (m.pos_51_60 || 0) + (m.pos_61_70 || 0) + (m.pos_71_80 || 0) +
      (m.pos_81_90 || 0) + (m.pos_91_100 || 0),
      m.is_new, m.is_up, m.is_down, m.is_lost,
      type,
    ]
  )
}

async function upsertKeywords(acronym, domain, keywords) {
  // Clear old keywords for this client first
  await pool.query(`DELETE FROM "ClientDFSEOKeyword" WHERE "clientAcronym" = $1`, [acronym])

  for (const item of keywords) {
    const el  = item.ranked_serp_element?.serp_item
    const kd  = item.keyword_data
    if (!el || !kd) continue
    await pool.query(
      `INSERT INTO "ClientDFSEOKeyword"
        ("clientAcronym","domain","keyword","position","searchVolume","url","positionType")
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT ("clientAcronym","keyword")
       DO UPDATE SET "position"=$4,"searchVolume"=$5,"url"=$6,"positionType"=$7,"pulledAt"=NOW()`,
      [
        acronym, domain,
        kd.keyword,
        el.rank_group,
        kd.keyword_info?.search_volume || 0,
        el.relative_url || null,
        el.type || null,
      ]
    )
  }
}

async function syncClient(acronym, domain) {
  console.log(`  → ${acronym} (${domain})`)

  try {
    // Pull historical (6 months) + ranked keywords in parallel
    const [histRes, kwRes] = await Promise.all([
      dfseoPost('dataforseo_labs/google/historical_rank_overview/live', [{
        target: domain,
        language_code: 'en',
        location_code: 2840,  // USA
      }]),
      dfseoPost('dataforseo_labs/google/ranked_keywords/live', [{
        target: domain,
        language_code: 'en',
        location_code: 2840,
        limit: 50,
        filters: [['keyword_data.keyword_info.search_volume', '>', 10]],
        order_by: ['ranked_serp_element.serp_item.rank_group,asc'],
      }]),
    ])

    // Store historical snapshots
    const histItems = histRes.tasks?.[0]?.result?.[0]?.items || []
    for (const item of histItems) {
      if (!item.year || !item.month) continue
      const snapshotDate = new Date(item.year, item.month - 1, 1)
      const m = item.metrics?.organic
      if (m) await upsertSnapshot(acronym, domain, snapshotDate, m, 'monthly')
    }

    // Store top keywords
    const kwItems = kwRes.tasks?.[0]?.result?.[0]?.items || []
    await upsertKeywords(acronym, domain, kwItems)

    console.log(`  ✓ ${acronym}: ${histItems.length} months history, ${kwItems.length} keywords`)
    return { months: histItems.length, keywords: kwItems.length }
  } catch (e) {
    console.error(`  ✗ ${acronym} failed:`, e.message)
    return { months: 0, keywords: 0 }
  }
}

async function main() {
  console.log('🔄 Syncing DataForSEO organic data...\n')

  // Get all active SEO clients with websites
  const res = await pool.query(
    `SELECT acronym, "companyName", website FROM "ClientProfile"
     WHERE status = 'active' AND website IS NOT NULL
     ORDER BY acronym`
  )

  let totalMonths = 0, totalKeywords = 0, skipped = 0

  for (const client of res.rows) {
    const domain = extractDomain(client.website)
    if (!domain) { console.log(`  ⚠ ${client.acronym}: no valid domain, skipping`); skipped++; continue }

    const { months, keywords } = await syncClient(client.acronym, domain)
    totalMonths += months
    totalKeywords += keywords

    // Rate limit: 200ms between clients
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\n✅ Done! ${totalMonths} snapshot rows, ${totalKeywords} keyword rows, ${skipped} skipped (no domain)`)
  await pool.end()
}

main().catch(async (e) => {
  console.error('Fatal:', e.message)
  await pool.end()
  process.exit(1)
})
