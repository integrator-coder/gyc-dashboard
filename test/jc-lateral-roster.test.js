const test = require('node:test')
const assert = require('node:assert/strict')
const { JC_JULY_LATERALS, applyAuditedJcLaterals } = require('../scripts/monthly-mrr-nrr-update')

test('JC audited July roster preserves all six lateral destinations and cadence', () => {
  assert.deepEqual(JC_JULY_LATERALS, {
    AN: { destinationProgram: 'SEO - Core', destinationCadence: 'Monthly' },
    LSAEE: { destinationProgram: 'SEO - Core', destinationCadence: 'Monthly' },
    KLC: { destinationProgram: 'SEO - Core', destinationCadence: 'Monthly' },
    GBD: { destinationProgram: 'Reputation Engine - Core', destinationCadence: 'Monthly' },
    GMLA: { destinationProgram: 'Reputation Engine - Core', destinationCadence: 'Monthly' },
    LTA: { destinationProgram: 'Reputation Engine - Core', destinationCadence: 'PIF' },
  })
})

test('audited roster overrides inferred churn buckets after cancellation persistence', async () => {
  const calls = []
  await applyAuditedJcLaterals({ query: async (sql, values) => calls.push({ sql, values }) })
  assert.equal(calls.length, 6)
  assert.deepEqual(calls.map(call => call.values[0]), ['AN', 'LSAEE', 'KLC', 'GBD', 'GMLA', 'LTA'])
  for (const call of calls) {
    assert.match(call.sql, /"classificationType"='internal_lateral'/)
    assert.match(call.sql, /"canceledMonth"='2026-07'/)
    assert.match(call.values[2], /not churn/)
  }
  assert.match(calls.at(-1).values[2], /\(PIF\)/)
})
