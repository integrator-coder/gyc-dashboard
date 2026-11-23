import fs from 'node:fs'
import Stripe from 'stripe'

const secrets = JSON.parse(fs.readFileSync(`${process.env.HOME}/.openclaw/secrets.json`, 'utf8'))
const stripe = new Stripe(secrets.STRIPE_SECRET_KEY)
const cursor = new Date('2023-01-01T00:00:00Z')
const currentMonth = new Date().toISOString().slice(0, 7)
const monthKeys = []
while (cursor.toISOString().slice(0, 7) <= currentMonth) {
  monthKeys.push(cursor.toISOString().slice(0, 7))
  cursor.setUTCMonth(cursor.getUTCMonth() + 1)
}

async function fetchMonth(month) {
  const startDate = new Date(`${month}-01T00:00:00Z`)
  const endDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1))
  const created = { gte: Math.floor(startDate.getTime() / 1000), lt: Math.floor(endDate.getTime() / 1000) }
  let cents = 0
  let chargeCount = 0
  for await (const charge of stripe.charges.list({ created, limit: 100 })) {
    if (charge.status !== 'succeeded' || !charge.paid) continue
    cents += charge.amount - (charge.amount_refunded || 0)
    chargeCount++
  }
  return { month, cash: Math.round(cents) / 100, chargeCount }
}

const result = []
for (let index = 0; index < monthKeys.length; index += 6) {
  result.push(...await Promise.all(monthKeys.slice(index, index + 6).map(fetchMonth)))
}

console.log(JSON.stringify(result, null, 2))
