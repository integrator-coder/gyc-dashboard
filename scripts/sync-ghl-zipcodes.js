#!/usr/bin/env node

/**
 * Sync zip codes from GHL contacts to ClientProfile in the dashboard DB
 * 
 * Fetches all contacts from GHL, then matches them to ClientProfile records
 * by ghlContactId or companyName/email, and updates zipCode, city, state.
 */

const https = require('https');
const { Pool } = require('pg');

// Load env from .env.local
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const DATABASE_URL = process.env.DATABASE_URL;

if (!GHL_API_KEY || !GHL_LOCATION_ID || !DATABASE_URL) {
  console.error('❌ Missing required env vars: GHL_API_KEY, GHL_LOCATION_ID, DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// Fetch all contacts from GHL with pagination
async function fetchAllGHLContacts() {
  const contacts = [];
  let nextPageUrl = `https://services.leadconnectorhq.com/contacts/?locationId=${GHL_LOCATION_ID}&limit=100`;
  
  console.log('📥 Fetching contacts from GHL...');
  
  while (nextPageUrl) {
    const data = await fetchGHLPage(nextPageUrl);
    contacts.push(...data.contacts);
    console.log(`  Fetched ${contacts.length} contacts so far...`);
    nextPageUrl = data.meta?.nextPageUrl || null;
  }
  
  console.log(`✅ Total contacts fetched: ${contacts.length}`);
  return contacts;
}

// Fetch a single page from GHL API
function fetchGHLPage(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28'
      }
    };
    
    https.get(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`GHL API error: ${res.statusCode} - ${body}`));
        } else {
          resolve(JSON.parse(body));
        }
      });
    }).on('error', reject);
  });
}

// Main sync function
async function syncZipCodes() {
  try {
    // Step 1: Fetch all GHL contacts
    const ghlContacts = await fetchAllGHLContacts();
    
    // Filter contacts with postalCode
    const contactsWithZip = ghlContacts.filter(c => c.postalCode);
    console.log(`📍 Contacts with postalCode: ${contactsWithZip.length} of ${ghlContacts.length}`);
    
    // Build lookup maps
    const byGhlId = new Map();
    const byCompanyName = new Map();
    const byEmail = new Map();
    
    for (const contact of contactsWithZip) {
      byGhlId.set(contact.id, contact);
      
      if (contact.companyName) {
        const normalized = contact.companyName.toLowerCase().trim();
        if (!byCompanyName.has(normalized)) {
          byCompanyName.set(normalized, []);
        }
        byCompanyName.get(normalized).push(contact);
      }
      
      if (contact.email) {
        const normalized = contact.email.toLowerCase().trim();
        if (!byEmail.has(normalized)) {
          byEmail.set(normalized, []);
        }
        byEmail.get(normalized).push(contact);
      }
    }
    
    // Step 2: Query ClientProfile records needing zipCode
    console.log('\n🔍 Querying ClientProfile records...');
    const { rows: profiles } = await pool.query(`
      SELECT 
        acronym, 
        "ghlContactId", 
        "companyName",
        email,
        "zipCode",
        city,
        state
      FROM "ClientProfile"
      WHERE "zipCode" IS NULL OR "zipCode" = ''
      ORDER BY acronym
    `);
    
    console.log(`📋 Found ${profiles.length} ClientProfile records with missing zipCode`);
    
    // Step 3: Match and update
    let matchedByGhlId = 0;
    let matchedByCompanyName = 0;
    let matchedByEmail = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const profile of profiles) {
      let ghlContact = null;
      let matchType = null;
      
      // Try matching by ghlContactId first
      if (profile.ghlContactId) {
        ghlContact = byGhlId.get(profile.ghlContactId);
        if (ghlContact) {
          matchType = 'ghlContactId';
          matchedByGhlId++;
        }
      }
      
      // Try matching by companyName
      if (!ghlContact && profile.companyName) {
        const normalized = profile.companyName.toLowerCase().trim();
        const candidates = byCompanyName.get(normalized) || [];
        if (candidates.length === 1) {
          ghlContact = candidates[0];
          matchType = 'companyName';
          matchedByCompanyName++;
        } else if (candidates.length > 1) {
          console.log(`  ⚠️  Multiple GHL contacts found for company: ${profile.companyName}`);
        }
      }
      
      // Try matching by email
      if (!ghlContact && profile.email) {
        const normalized = profile.email.toLowerCase().trim();
        const candidates = byEmail.get(normalized) || [];
        if (candidates.length === 1) {
          ghlContact = candidates[0];
          matchType = 'email';
          matchedByEmail++;
        } else if (candidates.length > 1) {
          console.log(`  ⚠️  Multiple GHL contacts found for email: ${profile.email}`);
        }
      }
      
      if (ghlContact && ghlContact.postalCode) {
        // Update the profile
        const result = await pool.query(`
          UPDATE "ClientProfile"
          SET 
            "zipCode" = $1,
            "city" = COALESCE(NULLIF("city", ''), $2),
            "state" = COALESCE(NULLIF("state", ''), $3)
          WHERE acronym = $4
          RETURNING acronym
        `, [
          ghlContact.postalCode,
          ghlContact.city || null,
          ghlContact.state || null,
          profile.acronym
        ]);
        
        if (result.rowCount > 0) {
          console.log(`  ✅ ${profile.acronym}: ${ghlContact.postalCode} (matched by ${matchType})`);
          updated++;
        }
      } else {
        skipped++;
      }
    }
    
    // Step 4: Report
    console.log('\n📊 Summary:');
    console.log(`  Total GHL contacts: ${ghlContacts.length}`);
    console.log(`  Contacts with postalCode: ${contactsWithZip.length}`);
    console.log(`  ClientProfile records needing zipCode: ${profiles.length}`);
    console.log(`  Matched by ghlContactId: ${matchedByGhlId}`);
    console.log(`  Matched by companyName: ${matchedByCompanyName}`);
    console.log(`  Matched by email: ${matchedByEmail}`);
    console.log(`  Updated with zipCode: ${updated}`);
    console.log(`  Skipped (no match or no zip): ${skipped}`);
    
    // Check remaining
    const { rows: remaining } = await pool.query(`
      SELECT COUNT(*) as count
      FROM "ClientProfile"
      WHERE "zipCode" IS NULL OR "zipCode" = ''
    `);
    
    console.log(`  Still missing zipCode: ${remaining[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run
syncZipCodes().then(() => {
  console.log('\n✅ Sync complete!');
  process.exit(0);
});
