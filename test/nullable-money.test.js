const test=require('node:test'),assert=require('node:assert/strict')
const {nullableNumber,summarizeNullableMoney}=require('../lib/nullable-money')

test('nullable money never serializes missing cash as zero',()=>{
  assert.equal(nullableNumber(null),null)
  assert.equal(nullableNumber(undefined),null)
  assert.equal(nullableNumber('0'),0)
  assert.equal(nullableNumber('10491.00'),10491)
})

test('cash summary separates verified dollars from pending records',()=>{
  assert.deepEqual(summarizeNullableMoney([{cash:'10491.00'},{cash:null}], 'cash'),{verifiedTotal:10491,pendingCount:1})
})
