import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createGoogleAuth } from '@/lib/google-auth'

export const dynamic = 'force-dynamic'

const SHEET_ID = '1SzmsEinQHF_Q_GigQB68xiWZIWRhYA___v-2zo_OJuc'
const SHEET_RANGE = 'WEB!A:P'
const MONTH_INDEX = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

function toNumber(value) {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  if (!normalized || normalized === '-') return null
  const parsed = Number(normalized.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function parseSheetDate(value) {
  if (!value) return null
  const match = String(value).trim().match(/^([A-Za-z]{3,9})\s+(\d{1,2})$/)
  if (!match) return null

  const monthToken = match[1].slice(0, 3).toLowerCase()
  const month = MONTH_INDEX[monthToken]
  const day = Number(match[2])

  if (month === undefined || Number.isNaN(day)) return null

  const year = month <= 7 ? 2026 : 2025
  const date = new Date(Date.UTC(year, month, day))
  return Number.isNaN(date.getTime()) ? null : date
}

function average(sum, count, decimals = 0) {
  if (!count) return 0
  return Number((sum / count).toFixed(decimals))
}

function pct(part, whole, decimals = 0) {
  if (!whole) return 0
  return Number(((part / whole) * 100).toFixed(decimals))
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(date) {
  return date.toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function quarterLabel(date) {
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1
  return `Q${quarter} ${date.getUTCFullYear()}`
}

function normalizeType(type) {
  const normalized = String(type || '').trim().toLowerCase()
  if (normalized === 'landing page') return 'landingPage'
  if (normalized === 'quick launch') return 'quickLaunch'
  if (normalized === 'full launch') return 'fullLaunch'
  return null
}

function createMonthlyBucket(date) {
  return {
    month: monthLabel(date),
    sortKey: monthKey(date),
    total: 0,
    onTime: 0,
    late: 0,
    ahead: 0,
    timelineScoreSum: 0,
    timelineScoreCount: 0,
    clientDelay: 0,
    internalDelay: 0,
    bothDelay: 0,
  }
}

function createQuarterlyBucket(date) {
  return {
    quarter: quarterLabel(date),
    sortKey: `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`,
    total: 0,
    onTime: 0,
    late: 0,
    ahead: 0,
    timelineScoreSum: 0,
    timelineScoreCount: 0,
    bugsSum: 0,
    bugsCount: 0,
  }
}

function finalizeMonthlyBucket(bucket) {
  return {
    month: bucket.month,
    sortKey: bucket.sortKey,
    total: bucket.total,
    onTime: bucket.onTime,
    late: bucket.late,
    ahead: bucket.ahead,
    onTimePct: pct(bucket.onTime + bucket.ahead, bucket.total),
    avgTimelineScore: average(bucket.timelineScoreSum, bucket.timelineScoreCount),
    clientDelay: bucket.clientDelay,
    internalDelay: bucket.internalDelay,
    bothDelay: bucket.bothDelay,
  }
}

function finalizeQuarterlyBucket(bucket) {
  return {
    quarter: bucket.quarter,
    sortKey: bucket.sortKey,
    total: bucket.total,
    onTime: bucket.onTime,
    late: bucket.late,
    ahead: bucket.ahead,
    onTimePct: pct(bucket.onTime + bucket.ahead, bucket.total),
    avgTimelineScore: average(bucket.timelineScoreSum, bucket.timelineScoreCount),
    avgBugs: average(bucket.bugsSum, bucket.bugsCount, 1),
  }
}

async function fetchSheetRows() {
  const auth = createGoogleAuth(['https://www.googleapis.com/auth/spreadsheets.readonly'])

  const sheets = google.sheets({ version: 'v4', auth })
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: SHEET_RANGE,
  })

  return response.data.values || []
}

export async function GET() {
  try {
    const rows = await fetchSheetRows()
    if (rows.length <= 1) {
      return NextResponse.json({
        monthlyHistory: [],
        quarterlyHistory: [],
        trailing30: { total: 0, onTime: 0, late: 0, onTimePct: 0, clientDelayPct: 0, internalDelayPct: 0 },
        allTime: {
          total: 0,
          onTimePct: 0,
          avgTimelineScore: 0,
          byType: { landingPage: 0, quickLaunch: 0, fullLaunch: 0 },
        },
        sheetId: SHEET_ID,
        lastUpdated: new Date().toISOString(),
      })
    }

    const now = new Date()
    const dataRows = rows.slice(1)
    const records = dataRows
      .map(row => {
        const goLiveDate = parseSheetDate(row[5])
        const dueDate = parseSheetDate(row[4])
        const status = String(row[6] || '').trim()
        const cause = String(row[7] || '').trim()
        const timelineScore = toNumber(row[9])
        const bugs = toNumber(row[12])
        const type = normalizeType(row[2])

        return {
          abbr: String(row[0] || '').trim(),
          center: String(row[1] || '').trim(),
          goLiveType: String(row[2] || '').trim(),
          websiteLevel: String(row[3] || '').trim(),
          dueDate,
          goLiveDate,
          effectiveDate: goLiveDate || dueDate,
          status,
          cause,
          timelineScore,
          bugs,
          type,
        }
      })
      .filter(record => record.effectiveDate && record.effectiveDate <= now && ['On time', 'Late', 'Ahead'].includes(record.status))
      .sort((a, b) => a.effectiveDate - b.effectiveDate)

    const monthlyBuckets = new Map()
    const quarterlyBuckets = new Map()
    const allTime = {
      total: 0,
      onTimeCount: 0,
      aheadCount: 0,
      timelineScoreSum: 0,
      timelineScoreCount: 0,
      byType: { landingPage: 0, quickLaunch: 0, fullLaunch: 0 },
    }

    const trailing30Start = new Date(now)
    trailing30Start.setUTCDate(trailing30Start.getUTCDate() - 30)

    const trailing30 = {
      total: 0,
      onTime: 0,
      late: 0,
      ahead: 0,
      clientDelay: 0,
      internalDelay: 0,
      bothDelay: 0,
    }

    for (const record of records) {
      const effectiveDate = record.effectiveDate
      const monthlyKey = monthKey(effectiveDate)
      const quarterKey = `${effectiveDate.getUTCFullYear()}-Q${Math.floor(effectiveDate.getUTCMonth() / 3) + 1}`

      if (!monthlyBuckets.has(monthlyKey)) monthlyBuckets.set(monthlyKey, createMonthlyBucket(effectiveDate))
      if (!quarterlyBuckets.has(quarterKey)) quarterlyBuckets.set(quarterKey, createQuarterlyBucket(effectiveDate))

      const monthly = monthlyBuckets.get(monthlyKey)
      const quarterly = quarterlyBuckets.get(quarterKey)

      monthly.total += 1
      quarterly.total += 1
      allTime.total += 1

      if (record.status === 'On time') {
        monthly.onTime += 1
        quarterly.onTime += 1
        allTime.onTimeCount += 1
      }
      if (record.status === 'Late') {
        monthly.late += 1
        quarterly.late += 1
      }
      if (record.status === 'Ahead') {
        monthly.ahead += 1
        quarterly.ahead += 1
        allTime.aheadCount += 1
      }

      if (record.timelineScore !== null) {
        monthly.timelineScoreSum += record.timelineScore
        monthly.timelineScoreCount += 1
        quarterly.timelineScoreSum += record.timelineScore
        quarterly.timelineScoreCount += 1
        allTime.timelineScoreSum += record.timelineScore
        allTime.timelineScoreCount += 1
      }

      if (record.bugs !== null) {
        quarterly.bugsSum += record.bugs
        quarterly.bugsCount += 1
      }

      if (record.status === 'Late') {
        if (record.cause === 'Client') {
          monthly.clientDelay += 1
          trailing30.clientDelay += effectiveDate >= trailing30Start ? 1 : 0
        }
        if (record.cause === 'Internal') {
          monthly.internalDelay += 1
          trailing30.internalDelay += effectiveDate >= trailing30Start ? 1 : 0
        }
        if (record.cause === 'Both') {
          monthly.bothDelay += 1
          trailing30.bothDelay += effectiveDate >= trailing30Start ? 1 : 0
        }
      }

      if (record.type) allTime.byType[record.type] += 1

      if (effectiveDate >= trailing30Start && effectiveDate <= now) {
        trailing30.total += 1
        if (record.status === 'On time') trailing30.onTime += 1
        if (record.status === 'Late') trailing30.late += 1
        if (record.status === 'Ahead') trailing30.ahead += 1
      }
    }

    const monthlyHistory = Array.from(monthlyBuckets.values())
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(finalizeMonthlyBucket)

    const quarterlyHistory = Array.from(quarterlyBuckets.values())
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(finalizeQuarterlyBucket)

    return NextResponse.json({
      monthlyHistory,
      quarterlyHistory,
      trailing30: {
        total: trailing30.total,
        onTime: trailing30.onTime + trailing30.ahead,
        late: trailing30.late,
        onTimePct: pct(trailing30.onTime + trailing30.ahead, trailing30.total),
        clientDelayPct: pct(trailing30.clientDelay, trailing30.late),
        internalDelayPct: pct(trailing30.internalDelay, trailing30.late),
      },
      allTime: {
        total: allTime.total,
        onTimePct: pct(allTime.onTimeCount + allTime.aheadCount, allTime.total),
        avgTimelineScore: average(allTime.timelineScoreSum, allTime.timelineScoreCount),
        byType: allTime.byType,
      },
      sheetId: SHEET_ID,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: error.message, sheetId: SHEET_ID }, { status: 500 })
  }
}
