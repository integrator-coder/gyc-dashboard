import pkg from 'pg'
const { Pool } = pkg
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

// Start a new job or resume an existing one
export async function startOrResumeJob({ jobId, agentId, jobType, inputContext, tenantId = 'gyc' }) {
  // Check for existing job
  const existing = await pool.query(
    `SELECT * FROM "AgentJobCheckpoint" WHERE "jobId"=$1 AND "agentId"=$2 LIMIT 1`,
    [jobId, agentId]
  )
  if (existing.rows[0] && existing.rows[0].status === 'running') {
    return { resumed: true, checkpoint: existing.rows[0].checkpoint, job: existing.rows[0] }
  }
  // Start fresh
  const result = await pool.query(
    `INSERT INTO "AgentJobCheckpoint" ("tenantId","jobId","agentId","jobType","status","inputContext")
     VALUES ($1,$2,$3,$4,'running',$5)
     ON CONFLICT ("jobId","agentId") DO UPDATE SET "status"='running',"startedAt"=now(),"updatedAt"=now()
     RETURNING *`,
    [tenantId, jobId, agentId, jobType, JSON.stringify(inputContext || {})]
  )
  return { resumed: false, checkpoint: null, job: result.rows[0] }
}

// Save checkpoint progress mid-job
export async function saveCheckpoint({ jobId, agentId, checkpoint, outputSoFar }) {
  await pool.query(
    `UPDATE "AgentJobCheckpoint" 
     SET "checkpoint"=$1, "outputSoFar"=$2, "updatedAt"=now()
     WHERE "jobId"=$3 AND "agentId"=$4`,
    [JSON.stringify(checkpoint), JSON.stringify(outputSoFar || {}), jobId, agentId]
  )
}

// Mark job complete
export async function completeJob({ jobId, agentId, outputSoFar }) {
  await pool.query(
    `UPDATE "AgentJobCheckpoint"
     SET "status"='completed', "completedAt"=now(), "updatedAt"=now(), "outputSoFar"=$1
     WHERE "jobId"=$2 AND "agentId"=$3`,
    [JSON.stringify(outputSoFar || {}), jobId, agentId]
  )
}

// Mark job failed
export async function failJob({ jobId, agentId, errorMessage }) {
  await pool.query(
    `UPDATE "AgentJobCheckpoint"
     SET "status"='failed', "completedAt"=now(), "updatedAt"=now(), "errorMessage"=$1
     WHERE "jobId"=$2 AND "agentId"=$3`,
    [errorMessage, jobId, agentId]
  )
}

// Get stalled jobs (running for >2h with no update)
export async function getStalledJobs(thresholdHours = 2) {
  const result = await pool.query(
    `SELECT * FROM "AgentJobCheckpoint"
     WHERE "status"='running'
     AND "updatedAt" < now() - INTERVAL '${thresholdHours} hours'
     ORDER BY "startedAt" ASC`
  )
  return result.rows
}
