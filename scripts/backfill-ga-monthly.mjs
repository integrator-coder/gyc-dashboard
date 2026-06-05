/**
 * backfill-ga-monthly.mjs
 * Pulls 13 months of GA4 data month-by-month for trend charts.
 * Writes to ClientWebsiteTrafficMonthly with source breakdown per month.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
  if (!data.access_token) throw new Error('Failed to get access token')
  return data.access_token
}

function getMonthRanges(numMonths = 13) {
  const ranges = []
  const now = new Date()
  for (let i = numMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    ranges.push({ start, end: endStr, month: monthKey })
  }
  return ranges
}

async function runMonthlyReport(accessToken, propertyId, startDate, endDate) {
  const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
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

// AI source domains to watch
const AI_SOURCES = [
  'chatgpt.com', 'chat.openai.com',
  'perplexity.ai', 'perplexity',
  'gemini.google.com', 'gemini',
  'claude.ai', 'anthropic.com',
  'copilot.microsoft.com', 'bing.com/chat',
  'you.com', 'phind.com', 'poe.com',
  'character.ai', 'pi.ai', 'mistral.ai',
]

async function runAISourceReport(accessToken, propertyId, startDate, endDate) {
  const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: 'sessions' }],
      dimensions: [{ name: 'sessionSource' }],
      dimensionFilter: {
        orGroup: {
          expressions: AI_SOURCES.map(src => ({
            filter: { fieldName: 'sessionSource', stringFilter: { matchType: 'CONTAINS', value: src, caseSensitive: false } }
          }))
        }
      },
      limit: 50,
    })
  })
  return resp.json()
}

function extractAcronym(displayName) {
  const match = displayName.match(/^([A-Z0-9\-]+)\s+[-–]\s+/)
  return match ? match[1] : null
}

async function listProperties(accessToken) {
  const accResp = await fetch('https://analyticsadmin.googleapis.com/v1beta/accounts?pageSize=200', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  const accData = await accResp.json()
  const allProps = []
  for (const acc of (accData.accounts || [])) {
    const propResp = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:${acc.name}&pageSize=200`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const propData = await propResp.json()
    for (const p of (propData.properties || [])) allProps.push(p)
  }
  return allProps
}

async function main() {
  console.log('Starting GA monthly backfill (13 months)...')
  const accessToken = await getAccessToken()
  const properties = await listProperties(accessToken)
  const monthRanges = getMonthRanges(13)
  
  console.log(`Properties: ${properties.length} | Months: ${monthRanges.length}`)
  console.log(`Range: ${monthRanges[0].month} → ${monthRanges[monthRanges.length-1].month}`)

  // Get active client acronyms
  const { rows: activeClients } = await pool.query('SELECT acronym FROM "ClientProfile" WHERE status=\'active\'')
  const activeAcronyms = new Set(activeClients.map(r => r.acronym))

  let synced = 0, skipped = 0, failed = 0

  for (const prop of properties) {
    const propId = prop.name.split('/').pop()
    const acronym = extractAcronym(prop.displayName)
    if (!acronym || !activeAcronyms.has(acronym)) { skipped++; continue }

    for (const { start, end, month } of monthRanges) {
      try {
        const report = await runMonthlyReport(accessToken, propId, start, end)
        if (!report.rows?.length) continue

        let sessions = 0, activeUsers = 0, newUsers = 0, bounceRate = 0, avgDuration = 0
        let organic = 0, paid = 0, direct = 0, organicSocial = 0, paidSocial = 0, referral = 0
        let rowCount = 0

        let aiChatgpt = 0, aiGemini = 0, aiPerplexity = 0, aiOther = 0

        for (const row of report.rows) {
          const channel = row.dimensionValues[0].value
          const channelLower = channel.toLowerCase()
          const vals = row.metricValues.map(v => parseFloat(v.value) || 0)
          sessions += vals[0]; activeUsers += vals[1]; newUsers += vals[2]
          bounceRate += vals[3]; avgDuration += vals[4]; rowCount++

          if (channel.includes('Organic Search')) organic += vals[0]
          else if (channel.includes('Paid Search')) paid += vals[0]
          else if (channel.includes('Direct')) direct += vals[0]
          else if (channel.includes('Organic Social')) organicSocial += vals[0]
          else if (channel.includes('Paid Social')) paidSocial += vals[0]
          else if (channel.includes('Referral')) referral += vals[0]
          // AI traffic channels
          else if (channelLower.includes('chatgpt') || channelLower.includes('chat.openai')) { aiChatgpt += vals[0] }
          else if (channelLower.includes('gemini') || channelLower.includes('bard')) { aiGemini += vals[0] }
          else if (channelLower.includes('perplexity')) { aiPerplexity += vals[0] }
          else if (channelLower.includes('ai overview') || channelLower.includes('ai mode') || channelLower.includes('copilot') || channelLower.includes('claude')) { aiOther += vals[0] }
        }
        // Also run source-level AI query to catch chatgpt.com, perplexity, etc.
        let aiChatgptSrc = 0, aiGeminiSrc = 0, aiPerplexitySrc = 0, aiOtherSrc = 0
        try {
          const aiReport = await runAISourceReport(accessToken, propId, start, end)
          for (const row of (aiReport.rows || [])) {
            const src = (row.dimensionValues[0].value || '').toLowerCase()
            const sessions = parseFloat(row.metricValues[0].value) || 0
            if (src.includes('chatgpt') || src.includes('openai')) aiChatgptSrc += sessions
            else if (src.includes('gemini')) aiGeminiSrc += sessions
            else if (src.includes('perplexity')) aiPerplexitySrc += sessions
            else aiOtherSrc += sessions
          }
        } catch { /* optional */ }
        // Use source-level counts when they exceed channel-level (more precise)
        const aiChatgptFinal = Math.max(aiChatgpt, aiChatgptSrc)
        const aiGeminiFinal = Math.max(aiGemini, aiGeminiSrc)
        const aiPerplexityFinal = Math.max(aiPerplexity, aiPerplexitySrc)
        const aiOtherFinal = Math.max(aiOther, aiOtherSrc)
        const aiTotal = aiChatgptFinal + aiGeminiFinal + aiPerplexityFinal + aiOtherFinal

        if (rowCount > 0) { bounceRate /= rowCount; avgDuration /= rowCount }

        await pool.query(`
          INSERT INTO "ClientWebsiteTrafficMonthly"
            ("tenantId", "clientAcronym", "propertyId", "periodMonth", sessions, "activeUsers", "newUsers",
             "engagementRate", "bounceRate", "avgSessionDuration", source, "checkedAt",
             "organicSearch", "paidSearch", "directSessions", "organicSocial", "paidSocial", referral,
             "aiTotal", "aiChatgpt", "aiGemini", "aiPerplexity", "aiOther")
          VALUES ('gyc',$1,$2,$3,$4,$5,$6,$7,$8,$9,'GA4-Monthly',NOW(),$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
          ON CONFLICT ("tenantId","clientAcronym","periodMonth") DO UPDATE SET
            "propertyId"=$2, sessions=$4, "activeUsers"=$5, "newUsers"=$6,
            "engagementRate"=$7, "bounceRate"=$8, "avgSessionDuration"=$9, source='GA4-Monthly', "checkedAt"=NOW(),
            "organicSearch"=$10, "paidSearch"=$11, "directSessions"=$12, "organicSocial"=$13, "paidSocial"=$14,
            referral=$15, "aiTotal"=$16, "aiChatgpt"=$17, "aiGemini"=$18, "aiPerplexity"=$19, "aiOther"=$20
        `, [acronym, propId, month,
            Math.round(sessions), Math.round(activeUsers), Math.round(newUsers),
            Math.round(100 - bounceRate * 100), Math.round(bounceRate * 100), avgDuration.toFixed(2),
            Math.round(organic), Math.round(paid), Math.round(direct), Math.round(organicSocial), Math.round(paidSocial),
            Math.round(referral), Math.round(aiTotal), Math.round(aiChatgptFinal), Math.round(aiGeminiFinal), Math.round(aiPerplexityFinal), Math.round(aiOtherFinal)])

        synced++
      } catch(e) {
        failed++
      }
      await new Promise(r => setTimeout(r, 80))
    }
    if (synced % 50 === 0) process.stdout.write('.')
  }

  console.log(`\nDone: ${synced} month-rows synced, ${failed} failed, ${skipped} skipped`)
  
  const { rows } = await pool.query('SELECT COUNT(*), MIN("periodMonth"), MAX("periodMonth") FROM "ClientWebsiteTrafficMonthly"')
  console.log('DB now:', rows[0].count, 'rows |', rows[0].min, '→', rows[0].max)
  await pool.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })

// This will be replaced — adding AI source lookup below
