/**
 * sync-ga-metrics.mjs
 * Syncs Google Analytics data for all client GA4 properties
 * Uses OAuth credentials (todd@growyourcenter.com)
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load env
const envContent = readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const [key, ...vals] = trimmed.split('=')
    env[key.trim()] = vals.join('=').trim()
  }
}

const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

// GA OAuth creds
const oauthCreds = JSON.parse(readFileSync('/Users/toddthejedigmail.com/.openclaw/credentials/google-oauth-ga.json', 'utf8'))

async function getAccessToken() {
  const params = new URLSearchParams({
    client_id: oauthCreds.client_id,
    client_secret: oauthCreds.client_secret,
    refresh_token: oauthCreds.refresh_token,
    grant_type: 'refresh_token',
  })
  const resp = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: params })
  const data = await resp.json()
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data))
  return data.access_token
}

async function listProperties(accessToken) {
  // First get all accounts
  const accResp = await fetch('https://analyticsadmin.googleapis.com/v1beta/accounts?pageSize=200', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  const accData = await accResp.json()
  const accounts = accData.accounts || []
  console.log(`Found ${accounts.length} GA accounts`)

  const allProps = []
  for (const acc of accounts) {
    const propResp = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:${acc.name}&pageSize=200`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const propData = await propResp.json()
    for (const p of (propData.properties || [])) {
      allProps.push(p)
    }
  }
  return allProps
}

async function runReport(accessToken, propertyId) {
  const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    })
  })
  return resp.json()
}

function extractAcronym(displayName) {
  // Parse "ABC - Company Name" -> "ABC"
  const match = displayName.match(/^([A-Z0-9\-]+)\s+[-–]\s+/)
  return match ? match[1] : null
}

async function main() {
  console.log('Starting GA metrics sync...')
  const accessToken = await getAccessToken()
  console.log('Auth OK')

  const properties = await listProperties(accessToken)
  console.log(`Found ${properties.length} GA4 properties`)

  let synced = 0, failed = 0, skipped = 0

  for (const prop of properties) {
    const propId = prop.name.split('/').pop()
    const acronym = extractAcronym(prop.displayName)
    
    if (!acronym) { skipped++; continue }

    // Check if client exists
    const clientCheck = await pool.query('SELECT acronym FROM "ClientProfile" WHERE acronym=$1 AND status=\'active\'', [acronym])
    if (!clientCheck.rows.length) { skipped++; continue }

    try {
      const report = await runReport(accessToken, propId)
      if (!report.rows) { skipped++; continue }

      // Aggregate metrics across channel groups
      let sessions = 0, activeUsers = 0, newUsers = 0, bounceRate = 0, avgDuration = 0
      let organic = 0, paid = 0, direct = 0, social = 0, referral = 0
      let rowCount = 0

      for (const row of (report.rows || [])) {
        const channel = row.dimensionValues[0].value
        const vals = row.metricValues.map(v => parseFloat(v.value) || 0)
        sessions += vals[0]
        activeUsers += vals[1]
        newUsers += vals[2]
        bounceRate += vals[3]
        avgDuration += vals[4]
        rowCount++

        if (channel.includes('Organic Search')) organic += vals[0]
        else if (channel.includes('Paid')) paid += vals[0]
        else if (channel.includes('Direct')) direct += vals[0]
        else if (channel.includes('Social')) social += vals[0]
        else if (channel.includes('Referral')) referral += vals[0]
      }

      if (rowCount > 0) {
        bounceRate = bounceRate / rowCount
        avgDuration = avgDuration / rowCount
      }

      await pool.query(`
        INSERT INTO "ClientGAMetrics" 
          (acronym, "propertyId", period, sessions, "activeUsers", "newUsers", "bounceRate",
           "organicSearch", "paidSearch", "directSessions", "organicSocial", "paidSocial",
           referral, "avgSessionDuration", "syncedAt", "tenantId")
        VALUES ($1,$2,'30d',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),'gyc')
        ON CONFLICT (acronym, period) DO UPDATE SET
          "propertyId"=$2, sessions=$3, "activeUsers"=$4, "newUsers"=$5, "bounceRate"=$6,
          "organicSearch"=$7, "paidSearch"=$8, "directSessions"=$9, "organicSocial"=$10,
          "paidSocial"=$11, referral=$12, "avgSessionDuration"=$13, "syncedAt"=NOW()
      `, [acronym, propId, sessions, activeUsers, newUsers, bounceRate, organic, paid, direct, social, paid, referral, avgDuration])

      console.log(`✅ ${acronym} (${propId}): ${Math.round(sessions)} sessions`)
      synced++
    } catch(e) {
      console.log(`❌ ${acronym}: ${e.message.split('\n')[0]}`)
      failed++
    }

    await new Promise(r => setTimeout(r, 100)) // Rate limit
  }

  console.log(`\nDone: ${synced} synced, ${failed} failed, ${skipped} skipped`)
  await pool.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
