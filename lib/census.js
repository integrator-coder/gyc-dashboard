/**
 * lib/census.js
 * Census Bureau API service module for GYC Market Intelligence.
 * Fetches ACS demographic data, CBP competitive data, and county FIPS lookups.
 */

const CENSUS_KEY = process.env.CENSUS_API_KEY || 'b35158bfd9e38593a6d0a5d2456fb2c25b3986ad'
const ACS_YEAR = '2024'
const CBP_YEAR = '2023'

// ACS 5-Year variables
const ACS_VARS = [
  'B01003_001E',  // total population
  'B09001_002E',  // children under 5
  'B09001_003E',  // children 5-9
  'B09001_004E',  // children 10-14
  'B19013_001E',  // median household income
  'B23008_002E',  // children under 6 with working parents
  'B17001_002E',  // population below poverty line
  'B16001_002E',  // Spanish-speaking households
  'B13002_001E',  // women (denominator for births)
  'B13002_006E',  // women who gave birth in past 12 months (married)
  'B13002_011E',  // women who gave birth in past 12 months (unmarried)
].join(',')

/**
 * Fetch ACS 5-year demographic data for a ZIP code.
 * @param {string} zip - 5-digit ZIP code
 * @returns {Object|null}
 */
export async function getACSDataForZip(zip) {
  const url = `https://api.census.gov/data/${ACS_YEAR}/acs/acs5?get=NAME,${ACS_VARS}&for=zip%20code%20tabulation%20area:${zip}&key=${CENSUS_KEY}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`ACS API error: ${res.status} for ZIP ${zip}`)
  const data = await res.json()
  if (!data || data.length < 2) return null

  const headers = data[0]
  const row = data[1]
  const get = (key) => {
    const idx = headers.indexOf(key)
    return idx >= 0 ? (parseInt(row[idx]) || 0) : 0
  }

  const birthsLastYear = get('B13002_006E') + get('B13002_011E')

  return {
    zip,
    totalPopulation: get('B01003_001E'),
    childrenUnder5: get('B09001_002E'),
    children5to9: get('B09001_003E'),
    children10to14: get('B09001_004E'),
    medianHouseholdIncome: get('B19013_001E'),
    workingParentsUnder6: get('B23008_002E'),
    belowPovertyLine: get('B17001_002E'),
    spanishSpeakingHouseholds: get('B16001_002E'),
    birthsLastYear,
    fetchedAt: new Date().toISOString(),
  }
}

/**
 * Look up state + county FIPS codes for a ZIP code.
 * Uses zippopotam.us for lat/lon, then Census geocoder for county FIPS.
 * @param {string} zip - 5-digit ZIP code
 * @returns {{ stateFips: string, countyFips: string }|null}
 */
export async function getCountyFipsForZip(zip) {
  try {
    // Step 1: get lat/lon from zippopotam.us (free, no key required)
    const zipRes = await fetch(`https://api.zippopotam.us/us/${zip}`, { cache: 'no-store' })
    if (!zipRes.ok) return null
    const zipData = await zipRes.json()
    const place = zipData?.places?.[0]
    if (!place) return null
    const lat = place.latitude
    const lon = place.longitude

    // Step 2: get county FIPS from Census geocoder using coordinates
    const geoUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json`
    const geoRes = await fetch(geoUrl, { cache: 'no-store' })
    if (!geoRes.ok) return null
    const geoData = await geoRes.json()
    const county = geoData?.result?.geographies?.Counties?.[0]
    if (!county) return null

    return {
      stateFips: String(county.STATE).padStart(2, '0'),
      countyFips: String(county.COUNTY).padStart(3, '0'),
    }
  } catch {
    return null
  }
}

/**
 * Fetch County Business Patterns data for NAICS 6244 (Child Day Care Services).
 * @param {string} stateFips - 2-digit state FIPS
 * @param {string} countyFips - 3-digit county FIPS
 * @returns {Object|null}
 */
export async function getCBPDataForCounty(stateFips, countyFips) {
  const url = `https://api.census.gov/data/${CBP_YEAR}/cbp?get=NAME,NAICS2017,ESTAB,EMP,PAYANN&for=county:${countyFips}&in=state:${stateFips}&NAICS2017=6244&key=${CENSUS_KEY}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (!data || data.length < 2) return null

    const headers = data[0]
    const row = data[1]
    return {
      countyName: row[0],
      childcareCenterCount: parseInt(row[headers.indexOf('ESTAB')]) || 0,
      childcareEmployment: parseInt(row[headers.indexOf('EMP')]) || 0,
      childcarePayroll: parseInt(row[headers.indexOf('PAYANN')]) || 0,  // in thousands
    }
  } catch {
    return null
  }
}

/**
 * Compute a 0-100 opportunity score for a market.
 * Higher = better opportunity (more demand, less supply, higher income).
 * @param {Object} params
 * @returns {number}
 */
export function computeOpportunityScore({ childrenUnder5 = 0, workingParentsUnder6 = 0, medianHouseholdIncome = 0, childcareCenterCount = 0, birthsLastYear = 0 }) {
  const demandScore = Math.min(100, (childrenUnder5 / 1000) * 20)         // up to 5000 children = 100
  const incomeScore = Math.min(100, (medianHouseholdIncome / 120000) * 100) // $120K = perfect
  const supplyPenalty = Math.min(50, childcareCenterCount * 2)              // each center costs 2 pts, max 50
  const birthBonus = Math.min(20, (birthsLastYear / 100) * 10)              // births signal future demand

  return Math.round(Math.max(0, demandScore * 0.4 + incomeScore * 0.35 + birthBonus * 0.15 - supplyPenalty * 0.1))
}
