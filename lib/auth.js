import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from '@/lib/pg'

const SESSION_COOKIE = 'gyc_session'
const SESSION_DAYS = 14

function normalizeRole(value) {
  return String(value || 'viewer').trim().toLowerCase()
}

function roleSetFromUser(user) {
  const baseRoles = [normalizeRole(user?.role)]
  const teams = Array.isArray(user?.teams) ? user.teams.map((team) => normalizeRole(team)) : []
  return Array.from(new Set([...baseRoles, ...teams].filter(Boolean)))
}

export function userHasRole(user, allowedRoles = []) {
  if (!user) return false
  const roles = roleSetFromUser(user)
  return allowedRoles.some((role) => roles.includes(normalizeRole(role)))
}

export async function getSessionUser() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value
  if (!sessionToken) return null

  const { rows } = await pool.query(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u."organizationId",
        u.disabled,
        COALESCE(array_agg(DISTINCT ut.team) FILTER (WHERE ut.team IS NOT NULL), ARRAY[]::text[]) AS teams
      FROM "Session" s
      JOIN "User" u ON u.id = s."userId"
      LEFT JOIN "UserTeam" ut ON ut."userId" = u.id
      WHERE s."sessionToken" = $1
        AND s.expires > NOW()
        AND (u.disabled IS NULL OR u.disabled = FALSE)
      GROUP BY u.id
      LIMIT 1
    `,
    [sessionToken]
  )

  if (!rows[0]) return null
  return rows[0]
}

export async function requireUser(allowedRoles = []) {
  const user = await getSessionUser()
  if (!user) {
    redirect(`/login?message=${encodeURIComponent('Please log in to access the Team Portal.')}`)
  }

  if (allowedRoles.length && !userHasRole(user, allowedRoles)) {
    redirect(`/login?message=${encodeURIComponent('Your account does not have access to that page.')}`)
  }

  return user
}

export async function authenticateUser(email, password) {
  const { rows } = await pool.query(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u."organizationId",
        u."passwordHash",
        u.disabled,
        COALESCE(array_agg(DISTINCT ut.team) FILTER (WHERE ut.team IS NOT NULL), ARRAY[]::text[]) AS teams
      FROM "User" u
      LEFT JOIN "UserTeam" ut ON ut."userId" = u.id
      WHERE lower(u.email) = lower($1)
      GROUP BY u.id
      LIMIT 1
    `,
    [email]
  )

  const user = rows[0]
  if (!user?.passwordHash) return null
  if (user.disabled) return null

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return null

  return user
}

export async function createSession(userId) {
  const sessionToken = randomUUID()
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await pool.query(
    `
      INSERT INTO "Session" (id, "sessionToken", "userId", expires)
      VALUES ($1, $2, $3, $4)
    `,
    [randomUUID(), sessionToken, userId, expires]
  )

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires,
    path: '/',
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value

  if (sessionToken) {
    await pool.query('DELETE FROM "Session" WHERE "sessionToken" = $1', [sessionToken])
  }

  cookieStore.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(0),
    path: '/',
  })
}

export async function requireApiUser(allowedRoles = []) {
  const user = await getSessionUser()
  if (!user) {
    return { error: 'Unauthorized', status: 401 }
  }

  if (allowedRoles.length && !userHasRole(user, allowedRoles)) {
    return { error: 'Forbidden', status: 403 }
  }

  return { user }
}

export function serializeUser(user) {
  if (!user) return null
  const roles = roleSetFromUser(user)
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    teams: Array.isArray(user.teams) ? user.teams.map(normalizeRole) : [],
    roles,
    organizationId: user.organizationId,
  }
}
