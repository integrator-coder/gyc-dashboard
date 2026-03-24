#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' })

const { randomUUID } = require('node:crypto')
const bcrypt = require('bcryptjs')
const { Client } = require('pg')

const USERS = [
  { name: 'Todd', email: 'todd@growyourcenter.com', role: 'admin', teams: [] , password: 'GYC-Admin-2026' },
  { name: 'Jesse', email: 'jesse@growyourcenter.com', role: 'sales', teams: ['sales'], password: 'GYC-Jesse-2026' },
  { name: 'Briana', email: 'briana@growyourcenter.com', role: 'sales', teams: ['sales', 'ga'], password: 'GYC-Briana-2026' },
  { name: 'JC', email: 'jc@growyourcenter.com', role: 'ga', teams: ['ga'], password: 'GYC-JC-2026' },
  { name: 'Stefen', email: 'stefen@growyourcenter.com', role: 'ga', teams: ['ga'], password: 'GYC-Stefen-2026' },
  { name: 'Sebastian', email: 'sebastian@growyourcenter.com', role: 'ga', teams: ['ga'], password: 'GYC-Sebastian-2026' },
  { name: 'Zu', email: 'zu@growyourcenter.com', role: 'ga', teams: ['ga'], password: 'GYC-Zu-2026' },
  { name: 'Pia', email: 'pia@growyourcenter.com', role: 'sales', teams: ['sales'], password: 'GYC-Pia-2026' },
  { name: 'CX Team', email: 'cx@growyourcenter.com', role: 'cx', teams: ['cx'], password: 'GYC-CX-2026' },
]

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

    for (const user of USERS) {
      const passwordHash = await bcrypt.hash(user.password, 10)
      const userId = randomUUID()
      await client.query(
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
        [userId, user.name, user.email, passwordHash, user.role, organizationId]
      )

      const existing = await client.query('SELECT id FROM "User" WHERE email = $1 LIMIT 1', [user.email])
      const finalUserId = existing.rows[0].id

      await client.query('DELETE FROM "UserTeam" WHERE "userId" = $1', [finalUserId])
      for (const team of user.teams) {
        await client.query(
          `
            INSERT INTO "UserTeam" (id, "userId", team)
            VALUES ($1, $2, $3)
            ON CONFLICT ("userId", team) DO NOTHING
          `,
          [randomUUID(), finalUserId, team]
        )
      }
    }

    await client.query(`
      UPDATE "ZoomCall"
      SET "classificationStatus" = 'needs-confirmation'
      WHERE COALESCE("classificationStatus", 'auto') = 'auto'
        AND acronym IS NULL
    `)

    await client.query('COMMIT')

    const users = await client.query('SELECT name, email, role FROM "User" ORDER BY email')
    const statuses = await client.query('SELECT "classificationStatus", count(*)::int AS count FROM "ZoomCall" GROUP BY 1 ORDER BY 2 DESC')

    console.log('Seeded users:')
    console.table(users.rows)
    console.log('ZoomCall classification statuses:')
    console.table(statuses.rows)
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
