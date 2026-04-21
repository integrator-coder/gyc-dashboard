import { pool } from '@/lib/pg'

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function getCurrentPeriodMonth(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function computeEnrollmentRollup(locations = []) {
  const activeLocations = locations.filter((location) => location && location.isActive !== false)

  if (activeLocations.length === 0) {
    return {
      hasActiveLocations: false,
      centerCapacity: null,
      currentEnrollment: null,
    }
  }

  let centerCapacity = 0
  let currentEnrollment = 0

  for (const location of activeLocations) {
    centerCapacity += toNullableNumber(location.capacity) ?? 0
    currentEnrollment += toNullableNumber(location.currentEnrollment) ?? 0
  }

  return {
    hasActiveLocations: true,
    centerCapacity,
    currentEnrollment,
  }
}

export async function ensureClientEnrollmentVerificationTable(queryable = pool) {
  await queryable.query(`
    CREATE TABLE IF NOT EXISTS "ClientEnrollmentVerification" (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      "tenantId" TEXT NOT NULL DEFAULT 'gyc',
      "clientAcronym" TEXT NOT NULL,
      "locationName" TEXT,
      "periodMonth" TEXT NOT NULL,
      status TEXT NOT NULL,
      capacity INTEGER,
      "currentEnrollment" INTEGER,
      "avgTuition" NUMERIC(10,2),
      "checkedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "checkedBy" TEXT,
      notes TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)

  await queryable.query(`
    CREATE INDEX IF NOT EXISTS "ClientEnrollmentVerification_client_idx"
      ON "ClientEnrollmentVerification" ("tenantId", "clientAcronym", "periodMonth" DESC)
  `)

  await queryable.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ClientEnrollmentVerification_client_period_unique"
      ON "ClientEnrollmentVerification" ("tenantId", "clientAcronym", "periodMonth")
      WHERE "locationName" IS NULL
  `)

  await queryable.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ClientEnrollmentVerification_location_period_unique"
      ON "ClientEnrollmentVerification" ("tenantId", "clientAcronym", "locationName", "periodMonth")
      WHERE "locationName" IS NOT NULL
  `)
}

export async function syncClientProfileEnrollmentRollup(queryable = pool, { tenantId = 'gyc', clientAcronym, locations = null }) {
  const upper = String(clientAcronym || '').toUpperCase()

  let sourceLocations = locations
  if (!Array.isArray(sourceLocations)) {
    const result = await queryable.query(
      `SELECT "isActive", capacity, "currentEnrollment"
       FROM "GBPLocation"
       WHERE "tenantId" = $1 AND "clientAcronym" = $2`,
      [tenantId, upper]
    )
    sourceLocations = result.rows
  }

  const rollup = computeEnrollmentRollup(sourceLocations)
  if (!rollup.hasActiveLocations) {
    return { ...rollup, updated: false }
  }

  const currentProfile = await getClientEnrollmentSnapshot(queryable, {
    tenantId,
    clientAcronym: upper,
  })

  if (
    currentProfile &&
    currentProfile.capacity === rollup.centerCapacity &&
    currentProfile.currentEnrollment === rollup.currentEnrollment
  ) {
    return { ...rollup, updated: false }
  }

  await queryable.query(
    `UPDATE "ClientProfile"
     SET "centerCapacity" = $1,
         "currentEnrollment" = $2,
         "updatedAt" = NOW()
     WHERE "tenantId" = $3 AND acronym = $4`,
    [String(rollup.centerCapacity), String(rollup.currentEnrollment), tenantId, upper]
  )

  return { ...rollup, updated: true }
}

export async function getClientEnrollmentSnapshot(queryable = pool, { tenantId = 'gyc', clientAcronym }) {
  const upper = String(clientAcronym || '').toUpperCase()
  const { rows } = await queryable.query(
    `SELECT acronym, "centerCapacity", "currentEnrollment", "avgTuition"
     FROM "ClientProfile"
     WHERE "tenantId" = $1 AND acronym = $2
     LIMIT 1`,
    [tenantId, upper]
  )

  const row = rows[0]
  if (!row) return null

  return {
    clientAcronym: row.acronym,
    capacity: toNullableNumber(row.centerCapacity),
    currentEnrollment: toNullableNumber(row.currentEnrollment),
    avgTuition: toNullableNumber(row.avgTuition),
  }
}

function serializeVerificationRow(row) {
  if (!row) return null
  return {
    ...row,
    capacity: row.capacity != null ? Number(row.capacity) : null,
    currentEnrollment: row.currentEnrollment != null ? Number(row.currentEnrollment) : null,
    avgTuition: row.avgTuition != null ? Number(row.avgTuition) : null,
  }
}

export async function upsertClientEnrollmentVerification(queryable = pool, {
  tenantId = 'gyc',
  clientAcronym,
  locationName = null,
  periodMonth = getCurrentPeriodMonth(),
  status,
  checkedBy = null,
  notes = null,
  checkedAt = new Date(),
} = {}) {
  const upper = String(clientAcronym || '').toUpperCase()

  if (!['checked_no_change', 'updated'].includes(status)) {
    const error = new Error('Invalid enrollment verification status.')
    error.status = 400
    throw error
  }

  await ensureClientEnrollmentVerificationTable(queryable)

  const snapshot = await getClientEnrollmentSnapshot(queryable, { tenantId, clientAcronym: upper })
  if (!snapshot) {
    const error = new Error('Client profile not found.')
    error.status = 404
    throw error
  }

  const normalizedLocationName = typeof locationName === 'string' && locationName.trim() ? locationName.trim() : null

  const updateResult = normalizedLocationName == null
    ? await queryable.query(
        `UPDATE "ClientEnrollmentVerification"
         SET status = $1,
             capacity = $2,
             "currentEnrollment" = $3,
             "avgTuition" = $4,
             "checkedAt" = $5,
             "checkedBy" = $6,
             notes = $7,
             "updatedAt" = NOW()
         WHERE "tenantId" = $8
           AND "clientAcronym" = $9
           AND "periodMonth" = $10
           AND "locationName" IS NULL
         RETURNING *`,
        [
          status,
          snapshot.capacity,
          snapshot.currentEnrollment,
          snapshot.avgTuition,
          checkedAt,
          checkedBy,
          notes,
          tenantId,
          upper,
          periodMonth,
        ]
      )
    : await queryable.query(
        `UPDATE "ClientEnrollmentVerification"
         SET status = $1,
             capacity = $2,
             "currentEnrollment" = $3,
             "avgTuition" = $4,
             "checkedAt" = $5,
             "checkedBy" = $6,
             notes = $7,
             "updatedAt" = NOW()
         WHERE "tenantId" = $8
           AND "clientAcronym" = $9
           AND "periodMonth" = $10
           AND "locationName" = $11
         RETURNING *`,
        [
          status,
          snapshot.capacity,
          snapshot.currentEnrollment,
          snapshot.avgTuition,
          checkedAt,
          checkedBy,
          notes,
          tenantId,
          upper,
          periodMonth,
          normalizedLocationName,
        ]
      )

  if (updateResult.rows[0]) {
    return serializeVerificationRow(updateResult.rows[0])
  }

  const insertResult = await queryable.query(
    `INSERT INTO "ClientEnrollmentVerification"
      ("tenantId", "clientAcronym", "locationName", "periodMonth", status, capacity, "currentEnrollment", "avgTuition", "checkedAt", "checkedBy", notes, "createdAt", "updatedAt")
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
     RETURNING *`,
    [
      tenantId,
      upper,
      normalizedLocationName,
      periodMonth,
      status,
      snapshot.capacity,
      snapshot.currentEnrollment,
      snapshot.avgTuition,
      checkedAt,
      checkedBy,
      notes,
    ]
  )

  return serializeVerificationRow(insertResult.rows[0])
}

export async function getLatestClientEnrollmentVerification(queryable = pool, { tenantId = 'gyc', clientAcronym }) {
  const upper = String(clientAcronym || '').toUpperCase()
  await ensureClientEnrollmentVerificationTable(queryable)

  const { rows } = await queryable.query(
    `SELECT *
     FROM "ClientEnrollmentVerification"
     WHERE "tenantId" = $1
       AND "clientAcronym" = $2
       AND "locationName" IS NULL
     ORDER BY "periodMonth" DESC, "checkedAt" DESC, id DESC
     LIMIT 1`,
    [tenantId, upper]
  )

  return serializeVerificationRow(rows[0])
}
