import pkg from 'pg'
const { Pool } = pkg
const pool = new Pool({ 
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
})

export async function logAgentAction({ agentId, agentName, action, target, targetId, summary, status = 'ok', errorMessage, durationMs, recordsAffected, tenantId = 'gyc' }) {
  try {
    await pool.query(
      `INSERT INTO "AgentAuditLog" ("tenantId","agentId","agentName","action","target","targetId","summary","status","errorMessage","durationMs","recordsAffected")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [tenantId, agentId, agentName, action, target || null, targetId || null, summary || null, status, errorMessage || null, durationMs || null, recordsAffected || null]
    )
  } catch (e) {
    // Never let audit logging crash the main operation
    console.error('[agent-audit] Failed to log:', e.message)
  }
}
