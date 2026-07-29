const test = require('node:test')
const assert = require('node:assert/strict')
const { derivePifDealPricing } = require('../lib/pif-deal-pricing')

test('PIF return MRR comes from the explicit post-term payment, not PIF cash or standard list price', () => {
  const result = derivePifDealPricing({
    'Growth - PIF': '$65,993',
    'Growth - Standard Monthly Rate': '$11,492/mo',
    'Growth - Month 7 on payment': '$3,999',
  }, 317)
  assert.deepEqual(result, { pif: true, pifAmount: 65993, mrr: 3999, renewalAmount: 3999 })
})

test('PIF without an explicit post-term payment stays unknown instead of using client Stripe MRR', () => {
  const result = derivePifDealPricing({ 'Core - PIF': '$10,491' }, 899)
  assert.deepEqual(result, { pif: true, pifAmount: 10491, mrr: 0, renewalAmount: 0 })
})

test('ordinary monthly deal may use its agreement rate', () => {
  const result = derivePifDealPricing({ 'Core - Standard Monthly Rate': '$995/mo' }, 899)
  assert.equal(result.renewalAmount, 995)
})
