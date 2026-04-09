/**
 * sync-dunning-history.mjs
 * Parses "Overdue Payment Tracker 2025" from Google Sheets and upserts
 * one DunningHistory record per client block into Neon.
 *
 * Sheet structure:
 *   Row 1: Section header
 *   Row 2: Column headers
 *   Row 3+: Client blocks separated by "TOTAL DUE" rows
 *   Cols: Client | Company | Due Date | Amount | Service/Product | Reason | (empty) | Catch-Up Date | Catch-Up Amount
 *   Section split: rows 3-113 = active overdue, rows 117+ = collections
 */
import pg from 'pg'
import { google } from 'googleapis'
import { readFileSync } from 'fs'
import { homedir } from 'os'

const { Client } = pg

// ── env ─────────────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}
loadEnv()

// ── helpers ──────────────────────────────────────────────────────────────────
function parseAmount(raw) {
  if (!raw) return 0
  const n = parseFloat(String(raw).replace(/[$,\s]/g, ''))
  return isNaN(n) ? 0 : n
}

function isNoteRow(v) {
  // Notes embedded in client name column — not real client names
  // These are standalone annotation rows, NOT mixed-in client rows like "Name -- annotation"
  return /^(seb |shut down|in collection|stefen |jc client|note$|client$)/i.test(v.trim())
}

function extractClientName(v) {
  // Handle "Real Name -- annotation" pattern → return "Real Name"
  const parts = v.split(/\s+--\s+/)
  return parts[0].trim()
}

function isHeaderOrTotal(row) {
  const a = (row[0] || '').trim()
  const c = (row[2] || '').trim()
  return (
    a === 'Client' ||
    c === 'TOTAL DUE' ||
    a === 'Collection Accounts' ||
    /TOTAL (DUE|PAID|OUTSTANDING|COLLECTED)/i.test(a) ||
    /TOTAL (DUE|PAID|OUTSTANDING|COLLECTED)/i.test(c)
  )
}

// ── parse sheet rows into client blocks ──────────────────────────────────────
function parseBlocks(rows) {
  let blocks = []
  let current = null
  let inCollections = false

  for (let i = 2; i < rows.length; i++) {  // skip rows 1-2 (headers)
    const row = rows[i]
    if (!row || row.length === 0) continue

    const col0 = (row[0] || '').trim()
    const col1 = (row[1] || '').trim()
    const col2 = (row[2] || '').trim()
    const col3 = (row[3] || '').trim()
    const col4 = (row[4] || '').trim()
    const col5 = (row[5] || '').trim()
    const col7 = (row[7] || '').trim()
    const col8 = (row[8] || '').trim()

    // Detect collections section header
    if (/Collection Accounts/i.test(col2) || /Collection Accounts/i.test(col0)) {
      inCollections = true
      continue
    }

    // Skip header/total rows
    if (isHeaderOrTotal(row)) {
      // "TOTAL DUE" row ends current block
      if (current && col2.toUpperCase() === 'TOTAL DUE') {
        blocks.push(current)
        current = null
      }
      continue
    }

    // New client block — col0 has a proper name (not a note)
    if (col0 && !isNoteRow(col0) && col0 !== col0.toUpperCase()) {
      // Save previous block if exists
      if (current) blocks.push(current)
      current = {
        clientName: extractClientName(col0).replace(/\s+/g, ' ').trim(),
        companyAcronym: col1 || null,
        inCollections,
        overdueItems: [],  // { dueDate, amount, service, reason }
        catchUpItems: [],  // { date, amount }
        notes: [],
      }
    }

    if (!current) continue

    // Catch notes in col0 (secondary lines)
    if (col0 && isNoteRow(col0)) {
      current.notes.push(col0)
    }

    // Overdue payment line — has an amount in col3
    const amt = parseAmount(col3)
    if (amt > 0 && col4 && !col4.startsWith('TOTAL')) {
      current.overdueItems.push({
        dueDate: col2 || null,
        amount: amt,
        service: col4,
        reason: col5 || null,
      })
    } else if (amt > 0 && col2 === 'Dispute') {
      // Dispute rows
      current.overdueItems.push({
        dueDate: 'Dispute',
        amount: amt,
        service: col4,
        reason: 'Dispute',
      })
    } else if (amt > 0 && !col2 && !col4) {
      // Contract balance rows (lump sum, no date or service)
      current.overdueItems.push({
        dueDate: null,
        amount: amt,
        service: 'Contract balance',
        reason: col5 || null,
      })
    } else if (amt > 0) {
      // Generic catch-all
      current.overdueItems.push({
        dueDate: col2 || null,
        amount: amt,
        service: col4 || 'Unknown',
        reason: col5 || null,
      })
    }

    // Catch-up payment line — has amount in col8
    const cuAmt = parseAmount(col8)
    if (cuAmt > 0) {
      current.catchUpItems.push({ date: col7 || null, amount: cuAmt })
    }
  }

  // Push last block if not ended by TOTAL DUE
  if (current) blocks.push(current)

  return blocks
}

// ── aggregate block → DB record ───────────────────────────────────────────────
function aggregateBlock(block) {
  const totalDue = block.overdueItems.reduce((s, x) => s + x.amount, 0)
  const totalCatchUp = block.catchUpItems.reduce((s, x) => s + x.amount, 0)
  const catchUpRate = totalDue > 0 ? Math.min(totalCatchUp / totalDue, 1) : 0

  const firstDueDates = block.overdueItems
    .map(x => x.dueDate)
    .filter(Boolean)
    .filter(d => d !== 'Dispute')
  const firstDueDate = firstDueDates[0] || null

  const services = [...new Set(block.overdueItems.map(x => x.service).filter(Boolean))]
  const reasons  = [...new Set(block.overdueItems.map(x => x.reason).filter(Boolean))]
  const notes    = block.notes.join(' | ') || null

  return {
    clientName:         block.clientName,
    companyAcronym:     block.companyAcronym,
    inCollections:      block.inCollections,
    totalAmountDue:     totalDue,
    totalCatchUpAmount: totalCatchUp,
    catchUpRate:        parseFloat(catchUpRate.toFixed(4)),
    firstDueDate,
    services:           JSON.stringify(services),
    reasons:            JSON.stringify(reasons),
    notes,
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Google Sheets
  const keyFile = process.env.GOOGLE_CREDENTIALS_PATH ||
    `${homedir()}/.openclaw/credentials/google-console.json`
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })

  console.log('📄 Reading Overdue Payment Tracker 2025…')
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: '1JAX7bhkx2Vc451kdm51a78-im0QjhLcRvRN6IeMQtws',
    range: "'Overdue Payment Tracker 2025'!A1:J200",
  })
  const rows = res.data.values || []
  console.log(`   ${rows.length} raw rows`)

  const blocks = parseBlocks(rows)
  console.log(`   ${blocks.length} client blocks parsed`)
  blocks.forEach(b => {
    const cu = b.catchUpItems.reduce((s,x)=>s+x.amount,0)
    const due = b.overdueItems.reduce((s,x)=>s+x.amount,0)
    console.log(`   • ${b.clientName} (${b.companyAcronym||'—'}) | due=$${due.toFixed(0)} | paid=$${cu.toFixed(0)} | collect=${b.inCollections}`)
  })

  const records = blocks.map(aggregateBlock)

  // Neon
  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  console.log('\n💾 Syncing to Neon…')

  // Clear and reload (small dataset, safe)
  await db.query(`DELETE FROM "DunningHistory" WHERE "tenantId" = 'gyc'`)

  let count = 0
  for (const r of records) {
    await db.query(`
      INSERT INTO "DunningHistory"
        ("tenantId","clientName","companyAcronym","inCollections","totalAmountDue",
         "totalCatchUpAmount","catchUpRate","firstDueDate","services","reasons","notes","syncedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
    `, [
      'gyc', r.clientName, r.companyAcronym, r.inCollections,
      r.totalAmountDue, r.totalCatchUpAmount, r.catchUpRate,
      r.firstDueDate, r.services, r.reasons, r.notes,
    ])
    count++
  }

  console.log(`✅ Synced ${count} records to DunningHistory`)

  // Quick stats
  const { rows: stats } = await db.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE "inCollections") as in_collections,
      AVG("catchUpRate") as avg_catchup_rate,
      SUM("totalAmountDue") as total_due,
      SUM("totalCatchUpAmount") as total_paid
    FROM "DunningHistory" WHERE "tenantId" = 'gyc'
  `)
  console.log('\n📊 Stats:')
  console.log(`   Total records: ${stats[0].total}`)
  console.log(`   In collections: ${stats[0].in_collections}`)
  console.log(`   Avg catch-up rate: ${(parseFloat(stats[0].avg_catchup_rate)*100).toFixed(1)}%`)
  console.log(`   Total due: $${parseFloat(stats[0].total_due).toLocaleString()}`)
  console.log(`   Total paid back: $${parseFloat(stats[0].total_paid).toLocaleString()}`)

  await db.end()
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
