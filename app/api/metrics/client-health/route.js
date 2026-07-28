import fs from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getContactsPage, getCustomFields } from '@/lib/ghl'

export const dynamic = 'force-dynamic'

const CACHE_PATH = path.join(process.cwd(), '.cache', 'client-health.json')

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function scoreBucket(avg) {
  if (avg >= 4) return 'green'
  if (avg >= 3) return 'yellow'
  return 'red'
}

function toNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function summarize(scoredContacts) {
  const summary = { green: 0, yellow: 0, red: 0, total: 0 }

  for (const contact of scoredContacts) {
    summary[contact.bucket] += 1
    summary.total += 1
  }

  const pct = key => (summary.total ? Number(((summary[key] / summary.total) * 100).toFixed(1)) : 0)

  return {
    ...summary,
    greenPct: pct('green'),
    yellowPct: pct('yellow'),
    redPct: pct('red'),
    contactsWithScores: scoredContacts.length,
  }
}

async function readCache() {
  try {
    const raw = await fs.readFile(CACHE_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function writeCache(payload) {
  await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true })
  await fs.writeFile(CACHE_PATH, JSON.stringify(payload, null, 2))
}

async function fetchHealthData() {
  const activeCustomers = await prisma.stripeCustomer.findMany({
    where: { status: { contains: 'active', mode: 'insensitive' } },
    select: { email: true, name: true },
  })

  const activeEmails = Array.from(
    new Set(activeCustomers.map(customer => normalizeEmail(customer.email)).filter(Boolean))
  )

  const customFields = await getCustomFields()
  const happinessField = customFields.find(field => /client happiness/i.test(field.name))
  const stabilityField = customFields.find(field => /business stability/i.test(field.name))

  if (!happinessField || !stabilityField) {
    return {
      ...summarize([]),
      fieldIds: {
        clientHappiness: happinessField?.id || null,
        businessStability: stabilityField?.id || null,
      },
      sampleSize: activeEmails.length,
      matchedContacts: 0,
      awaitingScores: true,
    }
  }

  const scoredContacts = []
  let matchedContacts = 0

  for (const email of activeEmails) {
    const { contacts } = await getContactsPage({ limit: 5, query: email })
    const match = contacts.find(contact => normalizeEmail(contact.email) === email)
    if (!match) continue

    matchedContacts += 1

    const byId = Object.fromEntries((match.customFields || []).map(field => [field.id, field.value]))
    const happiness = toNumber(byId[happinessField.id])
    const stability = toNumber(byId[stabilityField.id])

    if (happiness === null || stability === null) continue

    const avg = (happiness + stability) / 2
    scoredContacts.push({
      email,
      name: match.contactName || match.companyName || email,
      happiness,
      stability,
      avg,
      bucket: scoreBucket(avg),
    })
  }

  return {
    ...summarize(scoredContacts),
    fieldIds: {
      clientHappiness: happinessField.id,
      businessStability: stabilityField.id,
    },
    sampleSize: activeEmails.length,
    matchedContacts,
    awaitingScores: scoredContacts.length === 0,
  }
}

export async function getClientHealthMetrics() {
  try {
    const payload = {
      ...(await fetchHealthData()),
      cached: false,
      updatedAt: new Date().toISOString(),
    }

    await writeCache(payload)
    return payload
  } catch (error) {
    const cache = await readCache()
    if (cache) {
      return {
        ...cache,
        cached: true,
        cacheReason: error.message,
      }
    }

    throw error
  }
}

export async function GET() {
  try {
    return NextResponse.json(await getClientHealthMetrics())
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
