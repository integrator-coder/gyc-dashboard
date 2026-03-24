#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' })

const { randomUUID } = require('node:crypto')
const bcrypt = require('bcryptjs')
const { Client } = require('pg')

async function main() {
  const client = new Client({
    connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  await client.query('BEGIN')

  try {
    const orgResult = await client.query(
      `
        INSERT INTO "Organization" (name, slug, "createdAt", "updatedAt")
        VALUES ('Grow Your Childcare', 'gyc', NOW(), NOW())
        ON CONFLICT (slug) DO UPDATE SET "updatedAt" = NOW()
        RETURNING id
      `
    )
    const organizationId = orgResult.rows[0].id

    const passwordHash = await bcrypt.hash('GYC-Recon-2026', 10)
    const insertedUser = await client.query(
      `
        INSERT INTO "User" (id, name, email, "passwordHash", role, "organizationId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE
        SET
          name = EXCLUDED.name,
          "passwordHash" = EXCLUDED."passwordHash",
          role = EXCLUDED.role,
          "organizationId" = EXCLUDED."organizationId",
          "updatedAt" = NOW()
        RETURNING id
      `,
      [randomUUID(), 'Recon Reviewer', 'recon@growyourcenter.com', passwordHash, 'recon', organizationId]
    )

    const userId = insertedUser.rows[0].id
    await client.query('DELETE FROM "UserTeam" WHERE "userId" = $1 AND team = $2', [userId, 'recon'])
    await client.query(
      `
        INSERT INTO "UserTeam" (id, "userId", team)
        VALUES ($1, $2, $3)
        ON CONFLICT ("userId", team) DO NOTHING
      `,
      [randomUUID(), userId, 'recon']
    )

    const draftResult = await client.query(
      `
        INSERT INTO "ReconDraft" (
          "prospectName", "websiteUrl", "requestedBy", status, "rawAutoData", "validatedData", notes, "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, NULL, $6, NOW(), NOW())
        ON CONFLICT DO NOTHING
        RETURNING id
      `,
      [
        'Kigala Preschool',
        'https://kigala.org',
        'recon@growyourcenter.com',
        'pending-review',
        JSON.stringify({
          source: 'seed',
          locations: [
            {
              locationName: 'Kigala Preschool',
              city: 'Santa Monica',
              state: 'CA',
              gbpStatus: 'verified',
            },
          ],
        }),
        'Seeded sample recon draft for validation queue.',
      ]
    )

    let draftId = draftResult.rows[0]?.id
    if (!draftId) {
      const existing = await client.query(
        'SELECT id FROM "ReconDraft" WHERE "prospectName" = $1 AND "websiteUrl" = $2 LIMIT 1',
        ['Kigala Preschool', 'https://kigala.org']
      )
      draftId = existing.rows[0]?.id
    }

    if (!draftId) throw new Error('Failed to create or load Kigala Preschool draft.')

    await client.query(
      `
        DELETE FROM "ReconLocation"
        WHERE "reconDraftId" = $1
          AND "locationName" = $2
      `,
      [draftId, 'Kigala Preschool']
    )

    await client.query(
      `
        INSERT INTO "ReconLocation" (
          "reconDraftId", "locationName", city, state, "gbpClaimed", "gbpStatus", "autoData", "manualData", "locationIndex", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NULL, $8, NOW(), NOW())
      `,
      [
        draftId,
        'Kigala Preschool',
        'Santa Monica',
        'CA',
        'unknown',
        'verified',
        JSON.stringify({ locationName: 'Kigala Preschool', city: 'Santa Monica', state: 'CA', gbpStatus: 'verified' }),
        0,
      ]
    )

    await client.query('COMMIT')
    console.log(JSON.stringify({ ok: true, draftId, email: 'recon@growyourcenter.com' }, null, 2))
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
