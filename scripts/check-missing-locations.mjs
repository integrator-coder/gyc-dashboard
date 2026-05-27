import { config } from 'dotenv';
import pg from 'pg';
const { Client } = pg;

// Load environment variables
config({ path: '/Users/toddthejedigmail.com/.openclaw/workspace/gyc-dashboard/.env.local' });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

// First, check the schema
console.log('=== GBPLocation Table Schema ===');
const schemaQuery = `
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'GBPLocation'
  ORDER BY ordinal_position;
`;
const schemaResult = await client.query(schemaQuery);
console.log(schemaResult.rows);

// Check how many records exist
console.log('\n=== Total GBPLocation Records ===');
const countResult = await client.query('SELECT COUNT(*) FROM "GBPLocation"');
console.log(`Total records: ${countResult.rows[0].count}`);

// Check records missing gbpUrl
console.log('\n=== Records Missing gbpUrl ===');
const missingQuery = `
  SELECT id, "locationName", "clientAcronym", "gbpUrl", "gbpPlaceId"
  FROM "GBPLocation"
  WHERE "gbpUrl" IS NULL OR "gbpUrl" = ''
  LIMIT 20;
`;
const missingResult = await client.query(missingQuery);
console.log(`Records with missing gbpUrl: ${missingResult.rows.length}`);
missingResult.rows.forEach(row => {
  console.log(`  ID: ${row.id}, Location: ${row.locationName}, Client: ${row.clientAcronym}`);
});

// Get total count of missing
const missingCountResult = await client.query(`
  SELECT COUNT(*) FROM "GBPLocation"
  WHERE "gbpUrl" IS NULL OR "gbpUrl" = ''
`);
console.log(`\nTotal missing gbpUrl: ${missingCountResult.rows[0].count}`);

await client.end();
