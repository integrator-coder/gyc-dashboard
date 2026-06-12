/**
 * pull-cti-recordings.mjs
 * Pulls all [CTI] Ronnie recordings month by month from Zoom API
 * Zoom recording API max range = 30 days per request
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8')
for (const line of env.split('\n')) {
  const eq = line.indexOf('=')
  if (eq > 0 && !line.startsWith('#')) {
    const k = line.slice(0, eq).trim()
    const v = line.slice(eq + 1).trim()
    if (!process.env[k]) process.env[k] = v
  }
}

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function getZoomToken() {
  const creds = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
    { method: 'POST', headers: { Authorization: `Basic ${creds}` } })
  const data = await res.json()
  return data.access_token
}

async function getRecordingsForMonth(token, userId, from, to) {
  const res = await fetch(`https://api.zoom.us/v2/users/${userId}/recordings?from=${from}&to=${to}&page_size=100`,
    { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return []
  const data = await res.json()
  return data.meetings || []
}

async function getUsers(token) {
  const res = await fetch('https://api.zoom.us/v2/users?page_size=100&status=active',
    { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json()
  return data.users || []
}

async function main() {
  const token = await getZoomToken()
  const users = await getUsers(token)
  console.log(`Users: ${users.length}`)

  // Generate monthly date ranges from Jan 2024 to today
  const ranges = []
  let d = new Date('2024-01-01')
  const today = new Date()
  while (d < today) {
    const from = d.toISOString().slice(0, 10)
    const next = new Date(d)
    next.setMonth(next.getMonth() + 1)
    const to = (next > today ? today : next).toISOString().slice(0, 10)
    ranges.push({ from, to })
    d = next
  }
  console.log(`Date ranges: ${ranges.length} months`)

  const ctiRecordings = []

  for (const user of users) {
    console.log(`\nUser: ${user.email}`)
    for (const range of ranges) {
      const meetings = await getRecordingsForMonth(token, user.id, range.from, range.to)
      const cti = meetings.filter(m => 
        m.topic?.includes('[CTI]') || 
        m.topic?.toLowerCase().includes('ronnie') ||
        m.topic?.toLowerCase().includes('child time')
      )
      if (cti.length > 0) {
        console.log(`  ${range.from}: ${cti.length} CTI recordings`)
        ctiRecordings.push(...cti.map(m => ({ ...m, userEmail: user.email })))
      }
      await new Promise(r => setTimeout(r, 100))
    }
  }

  console.log(`\nTotal CTI recordings found: ${ctiRecordings.length}`)

  // Upsert each recording
  let inserted = 0
  for (const m of ctiRecordings) {
    const id = `zoom_${m.id}`
    const startTime = m.start_time ? new Date(m.start_time) : null
    const duration = m.duration ? m.duration * 60 : null
    
    // Check for transcript file
    const transcriptFile = (m.recording_files || []).find(f => f.file_type === 'TRANSCRIPT')
    const recordingFile = (m.recording_files || []).find(f => f.file_type === 'MP4' || f.file_type === 'M4A')
    
    await pool.query(`
      INSERT INTO "ZoomCall" (id, "meetingId", topic, "startTime", "durationSecs", acronym, "tenantId",
        "aiClassification", "classifiedAs", "classificationStatus", "clientProfileId",
        "hostEmail", "recordingUrl", "transcriptUrl", "aiSummary")
      VALUES ($1,$2,$3,$4,$5,'CTI','gyc','client_meeting','client_meeting','classified',80,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        acronym='CTI', "tenantId"='gyc', "aiClassification"='client_meeting',
        "classifiedAs"='client_meeting', "classificationStatus"='classified', "clientProfileId"=80
    `, [
      id, String(m.id), m.topic, startTime, duration,
      m.host_email || null,
      recordingFile?.play_url || null,
      transcriptFile?.download_url || null,
      m.topic || 'CTI Marketing Review'
    ])
    inserted++
    console.log(`  Inserted: ${startTime?.toISOString().slice(0,10)} | ${m.topic}`)
  }

  console.log(`\nInserted/updated ${inserted} CTI recordings`)
  const total = await pool.query("SELECT COUNT(*) FROM \"ZoomCall\" WHERE acronym='CTI'")
  console.log('Total CTI meetings now:', total.rows[0].count)
  await pool.end()
}

main().catch(e => { console.error(e); pool.end(); process.exit(1) })
