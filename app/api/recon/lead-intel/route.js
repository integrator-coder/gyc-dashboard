import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY
const CENSUS_API_KEY = process.env.CENSUS_API_KEY

export const dynamic = 'force-dynamic'

/**
 * GET /api/recon/lead-intel
 * Query params: address, zip, website, name
 * Returns: full lead intelligence brief (demographics, competitors, digital presence, pitch angle)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address') || ''
    const zip = searchParams.get('zip') || ''
    const website = searchParams.get('website') || ''
    const name = searchParams.get('name') || ''

    if (!address && !zip) {
      return NextResponse.json(
        { error: 'Either address or zip is required' },
        { status: 400 }
      )
    }

    // Step 1: Get lat/lng from address (if provided) using Geocoding API
    let lat, lng
    if (address) {
      const geoRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_PLACES_API_KEY}`
      )
      const geoData = await geoRes.json()
      if (geoData.results && geoData.results[0]) {
        lat = geoData.results[0].geometry.location.lat
        lng = geoData.results[0].geometry.location.lng
      }
    }

    // Step 2: Demographics (Census API)
    const demographics = await fetchDemographics(zip)

    // Step 3: Competitor Map (Google Places)
    const competitors = lat && lng 
      ? await fetchCompetitors(lat, lng)
      : { within3miles: [], within5miles: [] }

    // Step 4: Digital Presence
    const digitalPresence = await fetchDigitalPresence(name, address, website)

    // Step 5: Pitch Angle (Claude)
    const pitchAngle = await generatePitchAngle({
      prospectName: name,
      demographics,
      competitors,
      digitalPresence,
    })

    return NextResponse.json({
      prospect: { name, address, zip },
      demographics,
      competitors,
      digitalPresence,
      pitchAngle,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Lead intel error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate lead intel' },
      { status: 500 }
    )
  }
}

/**
 * Fetch demographics from Census API
 */
async function fetchDemographics(zip) {
  if (!zip) {
    return { population: null, medianIncome: null, familiesWithKids: null, error: 'No zip code provided' }
  }

  try {
    // Census ACS 5-year estimates
    // B01003_001E: Total population
    // B19013_001E: Median household income
    // B11004_003E: Families with children under 18
    const url = `https://api.census.gov/data/2022/acs/acs5?get=NAME,B01003_001E,B19013_001E,B11004_003E&for=zip%20code%20tabulation%20area:${zip}${CENSUS_API_KEY ? `&key=${CENSUS_API_KEY}` : ''}`
    
    const res = await fetch(url)
    const data = await res.json()

    if (!data || data.length < 2) {
      return { population: null, medianIncome: null, familiesWithKids: null, error: 'No data found for this zip' }
    }

    const [headers, values] = data
    const population = parseInt(values[1]) || 0
    const medianIncome = parseInt(values[2]) || 0
    const familiesWithKids = parseInt(values[3]) || 0

    return { population, medianIncome, familiesWithKids }
  } catch (error) {
    console.error('Census API error:', error)
    return { population: null, medianIncome: null, familiesWithKids: null, error: error.message }
  }
}

/**
 * Fetch competitors from Google Places API
 */
async function fetchCompetitors(lat, lng) {
  const competitors3mi = await searchPlaces(lat, lng, 4828) // 3 miles in meters
  const competitors5mi = await searchPlaces(lat, lng, 8047) // 5 miles in meters

  return {
    within3miles: competitors3mi,
    within5miles: competitors5mi,
  }
}

async function searchPlaces(lat, lng, radius) {
  try {
    // Using Places API Nearby Search
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=child_care&key=${GOOGLE_PLACES_API_KEY}`
    
    const res = await fetch(url)
    const data = await res.json()

    if (!data.results) return []

    return data.results.map((place) => ({
      name: place.name,
      rating: place.rating || 0,
      reviews: place.user_ratings_total || 0,
      address: place.vicinity || '',
      location: place.geometry?.location || null,
    }))
  } catch (error) {
    console.error('Places API error:', error)
    return []
  }
}

/**
 * Fetch digital presence data
 */
async function fetchDigitalPresence(name, address, website) {
  const gbp = await checkGBP(name, address)
  const pageSpeed = website ? await checkPageSpeed(website) : null
  const googleAds = 'unknown' // Placeholder - would need SerpAPI or similar

  return {
    gbp: gbp || { claimed: false, rating: 0, reviews: 0 },
    pageSpeed: pageSpeed || { mobile: 0, desktop: 0 },
    googleAds,
  }
}

async function checkGBP(name, address) {
  try {
    // Use Places Text Search to find the GBP listing
    const query = encodeURIComponent(`${name} ${address}`)
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${GOOGLE_PLACES_API_KEY}`
    
    const res = await fetch(url)
    const data = await res.json()

    if (!data.results || data.results.length === 0) {
      return { claimed: false, rating: 0, reviews: 0 }
    }

    const place = data.results[0]
    return {
      claimed: true,
      rating: place.rating || 0,
      reviews: place.user_ratings_total || 0,
      status: place.business_status || 'OPERATIONAL',
    }
  } catch (error) {
    console.error('GBP check error:', error)
    return { claimed: false, rating: 0, reviews: 0, error: error.message }
  }
}

async function checkPageSpeed(url) {
  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${GOOGLE_PLACES_API_KEY}`
    
    const res = await fetch(apiUrl)
    const data = await res.json()

    const mobileScore = Math.round((data.lighthouseResult?.categories?.performance?.score || 0) * 100)
    
    // Run desktop separately
    const desktopUrl = `${apiUrl}&strategy=desktop`
    const desktopRes = await fetch(desktopUrl)
    const desktopData = await desktopRes.json()
    const desktopScore = Math.round((desktopData.lighthouseResult?.categories?.performance?.score || 0) * 100)

    return { mobile: mobileScore, desktop: desktopScore }
  } catch (error) {
    console.error('PageSpeed API error:', error)
    return { mobile: 0, desktop: 0, error: error.message }
  }
}

/**
 * Generate pitch angle using Claude
 */
async function generatePitchAngle(context) {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const prompt = `You are a sales intelligence analyst for GYC (Grow Your Center), a marketing company that helps childcare centers.

Based on this prospect intelligence, identify the single strongest pitch angle for GYC's services.

**Prospect:** ${context.prospectName}

**Market Demographics:**
- Population: ${context.demographics.population || 'unknown'}
- Median Income: $${context.demographics.medianIncome?.toLocaleString() || 'unknown'}
- Families with Kids: ${context.demographics.familiesWithKids || 'unknown'}

**Competitors:**
- Within 3 miles: ${context.competitors.within3miles.length} centers
- Within 5 miles: ${context.competitors.within5miles.length} centers

**Digital Presence:**
- GBP Claimed: ${context.digitalPresence.gbp.claimed ? 'Yes' : 'No'}
- GBP Reviews: ${context.digitalPresence.gbp.reviews || 0} (${context.digitalPresence.gbp.rating || 0} stars)
- Website Speed: Mobile ${context.digitalPresence.pageSpeed.mobile}/100, Desktop ${context.digitalPresence.pageSpeed.desktop}/100
- Google Ads: ${context.digitalPresence.googleAds}

**GYC Services:**
- **Done For You:** Full-service marketing (best for centers with zero digital presence or very low capacity)
- **Blueprint:** Done-with-you marketing (best for centers who want to learn but need structure)
- **M3:** AI-powered dashboard platform (best for centers who are already marketing-savvy)

Return a 1-2 sentence pitch angle that connects the data to the strongest service fit. Be specific about what gap you see and why GYC is the solution.`

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    return message.content[0].text
  } catch (error) {
    console.error('Claude pitch generation error:', error)
    return 'Unable to generate pitch angle — review the data manually.'
  }
}
