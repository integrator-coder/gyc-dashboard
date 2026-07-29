const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { Client } = require('pg')
const { pifReturnFact, summarizePifReturns } = require('../lib/pif-return-facts')
const { fetchConfirmedPifReturns } = require('../lib/pif-return-query')
const { assertSafeTestDatabaseUrl } = require('../lib/test-database-safety')

const palm = { clientName: 'Palm Beach Preschool', mrrMoved: 395, returningMrr: 3999, pifCashReceived: 65993, returningProgram: 'Reputation Engine' }
const primrose = { clientName: 'Primrose School of Burlington', mrrMoved: 899, returningMrr: null, pifCashReceived: 10491, returningProgram: 'Reputation Engine' }

test('Palm paused MRR, return MRR, and PIF cash remain separate facts', () => {
  assert.deepEqual(pifReturnFact(palm), { pausedMrr: 395, returningMrr: 3999, pifCash: 65993, returningProgram: 'Reputation Engine' })
})

test('Primrose unknown return remains pending and is not coerced to zero or outgoing MRR', () => {
  assert.deepEqual(pifReturnFact(primrose), { pausedMrr: 899, returningMrr: null, pifCash: 10491, returningProgram: 'Reputation Engine' })
  assert.deepEqual(summarizePifReturns([palm, primrose]), { pausedMrr: 1294, returningMrr: 3999, pendingReturnMrr: 1 })
})

test('shared API query maps stable client/date and leaves invalid PIF totals pending', async t => {
  if (!process.env.TEST_DATABASE_URL) {
    t.skip('TEST_DATABASE_URL not set; DB integration test is fail-closed and does not load .env.local')
    return
  }
  const connectionString = assertSafeTestDatabaseUrl(process.env.TEST_DATABASE_URL)
  const db = new Client({ connectionString, ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false } })
  const schema = `pif_return_${crypto.randomBytes(6).toString('hex')}`
  await db.connect()
  try {
    await db.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}";
      CREATE TABLE "ClientProfile" (id bigint primary key, acronym text, "companyName" text);
      CREATE TABLE "ClientStripeLink" ("stripeCustomerId" text, "clientProfileId" bigint);
      CREATE TABLE "ChurnLateralMovement" ("tenantId" text,"canceledSubscriptionId" text,"stripeCustomerId" text,"clientName" text,"movementDate" date,"mrrMoved" numeric,"pifCashReceived" numeric,"termMonths" int,"scheduledReturnDate" date,status text);
      CREATE TABLE "SalesDeal" (id bigserial primary key,"tenantId" text,"clientName" text,"dealDate" date,"renewalAmount" numeric,"firstPayment" numeric,pif boolean,"pifOverride" boolean,service text);
      INSERT INTO "ClientProfile" VALUES (1,'PB','Palm Beach Preschool'),(2,'PSB','Primrose School of Burlington');
      INSERT INTO "ClientStripeLink" VALUES ('cus_pb',1),('cus_psb',2);
      INSERT INTO "ChurnLateralMovement" VALUES
        ('gyc','sub_pb','cus_pb','Palm Beach Preschool','2026-07-16',395,65993,6,'2027-01-16','confirmed'),
        ('gyc','sub_psb','cus_psb','Primrose School of Burlington','2026-07-02',899,10491,6,'2027-01-02','confirmed');
      INSERT INTO "SalesDeal" ("tenantId","clientName","dealDate","renewalAmount","firstPayment",pif,"pifOverride",service) VALUES
        ('gyc','Palm Beach Preschools','2026-07-16',3999,65993,true,null,'Reputation Engine'),
        ('gyc','Palm Beach Preschools','2026-07-15',7777,65993,true,null,'Wrong date'),
        ('gyc','Primrose School of Burlington','2026-07-02',10491,10491,true,null,'Reputation Engine');`)
    const rows = await fetchConfirmedPifReturns(db)
    const byClient = Object.fromEntries(rows.map(row => [row.clientName, pifReturnFact(row)]))
    assert.deepEqual(byClient['Palm Beach Preschool'], { pausedMrr: 395, returningMrr: 3999, pifCash: 65993, returningProgram: 'Reputation Engine' })
    assert.deepEqual(byClient['Primrose School of Burlington'], { pausedMrr: 899, returningMrr: null, pifCash: 10491, returningProgram: null })
  } finally {
    await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {})
    await db.end()
  }
})

test('test database guard rejects production-like and non-test database URLs', () => {
  const pg = (host, database) => `postgres://${host}/${database}`
  assert.throws(() => assertSafeTestDatabaseUrl(), /required/)
  assert.throws(() => assertSafeTestDatabaseUrl(pg('host.neon.tech', 'safe_test')), /production-like/)
  assert.throws(() => assertSafeTestDatabaseUrl(pg('localhost', 'gyc_dashboard')), /test-scoped/)
  assert.throws(() => assertSafeTestDatabaseUrl(pg('localhost', 'dashboard')), /test-scoped/)
  assert.equal(assertSafeTestDatabaseUrl(pg('localhost', 'gyc_dashboard_test')), pg('localhost', 'gyc_dashboard_test'))
})
