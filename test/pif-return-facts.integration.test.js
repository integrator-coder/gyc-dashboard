const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pifReturnFact, summarizePifReturns } = require('../lib/pif-return-facts')

const palm = { clientName: 'Palm Beach Preschool', mrrMoved: 395, returningMrr: 3999, pifCashReceived: 65993, returningProgram: 'Reputation Engine' }
const primrose = { clientName: 'Primrose School of Burlington', mrrMoved: 899, returningMrr: null, pifCashReceived: 10491, returningProgram: 'Reputation Engine' }

test('Palm paused MRR, return MRR, and PIF cash remain separate facts', () => {
  assert.deepEqual(pifReturnFact(palm), { pausedMrr: 395, returningMrr: 3999, pifCash: 65993, returningProgram: 'Reputation Engine' })
})

test('Primrose unknown return remains pending and is not coerced to zero or outgoing MRR', () => {
  assert.deepEqual(pifReturnFact(primrose), { pausedMrr: 899, returningMrr: null, pifCash: 10491, returningProgram: 'Reputation Engine' })
  assert.deepEqual(summarizePifReturns([palm, primrose]), { pausedMrr: 1294, returningMrr: 3999, pendingReturnMrr: 1 })
})

test('all three PIF/churn APIs expose the mapped return field and reject invalid contract totals', () => {
  for (const route of ['app/api/metrics/churn/route.js', 'app/api/metrics/finance/churn/route.js', 'app/api/metrics/pif-mrr/route.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', route), 'utf8')
    assert.match(source, /returningMrr|mrrReturnAmount/)
    assert.match(source, /renewalAmount[^\n]*<[^\n]*firstPayment/)
  }
})
