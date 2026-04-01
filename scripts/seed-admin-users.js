#!/usr/bin/env node
/**
 * Seed initial admin/superadmin users for GYC Dashboard
 * Run with: node --env-file=.env.local scripts/seed-admin-users.js
 */

const pkg = require('pg')
const { Pool } = pkg
const bcrypt = require('bcryptjs')
const { randomUUID } = require('crypto')

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const TEMP_PASSWORD = 'GYC2026!'

const USERS = [
  { email: 'todd@growyourcenter.com',     name: 'Todd',     role: 'superadmin' },
  { email: 'bruce@growyourcenter.com',    name: 'Bruce',    role: 'admin' },
  { email: 'zac@growyourcenter.com',      name: 'Zac',      role: 'admin' },
  { email: 'carmella@growyourcenter.com', name: 'Carmella', role: 'admin' },
  { email: 'lex@growyourcenter.com',      name: 'Lex',      role: 'admin' },
  { email: 'travis@growyourcenter.com',   name: 'Travis',   role: 'admin' },
]

async function seedUsers() {
  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 12)
  const now = new Date()

  for (const user of USERS) {
    const { email, name, role } = user

    // Check if exists
    const existing = await pool.query(`SELECT id, role FROM "User" WHERE lower(email) = lower($1)`, [email])

    if (existing.rows.length > 0) {
      const current = existing.rows[0]
      if (current.role !== role) {
        // Update role if different
        await pool.query(`UPDATE "User" SET role = $1, "updatedAt" = $2 WHERE id = $3`, [role, now, current.id])
        console.log(`✅ Updated role for ${email}: ${current.role} → ${role}`)
      } else {
        console.log(`⏭️  Skipped ${email} (already exists with role: ${role})`)
      }
      continue
    }

    const id = randomUUID()
    await pool.query(
      `INSERT INTO "User" (id, name, email, "passwordHash", role, "organizationId", disabled, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 1, FALSE, $6, $6)`,
      [id, name, email.toLowerCase(), passwordHash, role, now]
    )
    console.log(`✅ Created ${email} (${role})`)
  }

  console.log('\n✅ Done! Temp password for all new users: ' + TEMP_PASSWORD)
  await pool.end()
}

seedUsers().catch((e) => {
  console.error('❌ Error:', e.message)
  pool.end()
  process.exit(1)
})
