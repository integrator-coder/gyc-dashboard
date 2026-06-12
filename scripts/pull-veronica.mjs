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

async function getToken() {
  const creds = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64')
  const r = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
    { method: 'POST', headers: { Authorization: `Basic ${creds}` } })
  return (await r.json()).access_token
}

async function main() {
  const token = await getToken()
  const usersR = await fetch('https://api.zoom.us/v2/users?page_size=100&status=active', { headers: { Authorization: `Bearer ${token}` } })
  const users = (await usersR.json()).users || []
  
  // Generate monthly ranges for past 18 months
  const ranges = []
  let d = new Date('2025-01-01')
  const today = new Date()
  while (d < today) {
    const from = d.toISOString().slice(0, 10)
    const next = new Date(d); next.setMonth(next.getMonth() + 1)
    const to = (next > today ? today : next).toISOString().slice(0, 10)
    ranges.push({ from, to })
    d = next
  }
  
  let found = 0
  for (const user of users) {
    for (const range of ranges) {
      const r = await fetch(`https://api.zoom.us/v2/users/${user.id}/recordings?from=${range.from}&to=${range.to}&page_size=100`,
        { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) continue
      const data = await r.json()
      const veronica = (data.meetings || []).filter(m => 
        m.topic?.toLowerCase().includes('veronica') || m.topic?.toLowerCase().includes('veronica nelson')
      )
      for (const m of veronica) {
        const id = `zoom_${m.id}`
        await pool.query(`INSERT INTO "ZoomCall" (id,"meetingId",topic,"startTime","durationSecs",acronym,"tenantId","aiClassification","classifiedAs","classificationStatus","clientProfileId","hostEmail","recordingUrl","aiSummary") VALUES ($1,$2,$3,$4,$5,'CTI','gyc','client_meeting','client_meeting','classified',80,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET acronym='CTI',"aiClassification"='client_meeting',"clientProfileId"=80`,
          [id, String(m.id), m.topic, m.start_time ? new Date(m.start_time) : null, m.duration ? m.duration*60 : null, m.host_email || null, null, m.topic || 'CTI Meeting'])
        console.log('Added Veronica recording:', m.start_time?.slice(0,10), '|', m.topic)
        found++
      }
      await new Promise(r => setTimeout(r, 80))
    }
  }
  
  console.log(`Found ${found} Veronica Nelson recordings`)
  const total = await pool.query(`SELECT COUNT(*) FROM "ZoomCall" WHERE acronym='CTI'`)
  console.log('Total CTI:', total.rows[0].count)
  await pool.end()
}

main().catch(e => { console.error(e); pool.end() })
