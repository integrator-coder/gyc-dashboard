import { google } from 'googleapis';

const DOC_ID = '1vfOjQ70vBD32D7CCroXIpVSS488nzmiiGvUMS3p-_Qk';
const DASHBOARD_URL = 'https://gyc-dashboard-ra9a.onrender.com';
const PASSWORD = 'GYC-Admin-2026!';

const auth = new google.auth.GoogleAuth({
  keyFile: '/Users/toddthejedigmail.com/.openclaw/workspace/google-service-account.json',
  scopes: ['https://www.googleapis.com/auth/documents'],
});
const docs = google.docs({ version: 'v1', auth });

const team = [
  { name: 'Bruce',     email: 'bruce@growyourcenter.com',     role: 'superadmin', note: 'You have full admin access to all dashboards and data.' },
  { name: 'Kaci',      email: 'kaci@growyourcenter.com',      role: 'superadmin', note: 'You have full admin access to all dashboards and data.' },
  { name: 'Lex',       email: 'lex@growyourcenter.com',       role: 'admin',      note: 'You have admin access to finance, client, and ops data.' },
  { name: 'Travis',    email: 'travis@growyourcenter.com',    role: 'admin',      note: 'You have admin access to finance, client, and ops data.' },
  { name: 'Zac',       email: 'zac@growyourcenter.com',       role: 'admin',      note: 'You have admin access to finance, client, and ops data.' },
  { name: 'Carmella',  email: 'carmella@growyourcenter.com',  role: 'admin',      note: 'You have admin access to finance, client, and ops data.' },
  { name: 'Lada',      email: 'lada@growyourcenter.com',      role: 'admin',      note: 'You have admin access to production and ops dashboards.' },
  { name: 'Jesse',     email: 'jesse@growyourcenter.com',     role: 'sales',      note: 'You have access to the Sales dashboard and your performance metrics.' },
  { name: 'Pia',       email: 'pia@growyourcenter.com',       role: 'sales',      note: 'You have access to the Sales dashboard and your performance metrics.' },
  { name: 'Briana',    email: 'briana@growyourcenter.com',    role: 'ga',         note: 'You have access to your client dashboards and production data.' },
  { name: 'Sebastian', email: 'sebastian@growyourcenter.com', role: 'ga',         note: 'You have access to your client dashboards and production data.' },
  { name: 'JC',        email: 'jc@growyourcenter.com',        role: 'ga',         note: 'You have access to your client dashboards and paid media data.' },
  { name: 'Stefen',    email: 'stefen@growyourcenter.com',    role: 'ga',         note: 'You have access to your client dashboards and paid media data.' },
  { name: 'Zu',        email: 'zu@growyourcenter.com',        role: 'ga',         note: 'You have access to your client dashboards and CRM data.' },
];

const betaBody = `This is a BETA launch — your feedback is critical to making this tool work for the whole team. Here's what we need from you:

1. DATA VALIDATION (most important): Does the data you see match what you know to be true? Are client numbers accurate? Are your metrics correct? If anything looks off — even slightly — flag it. Bad data is worse than no data.

2. BUG REPORTS: If something doesn't load, looks broken, or behaves unexpectedly, screenshot it and send it to Todd.

3. FEATURE IDEAS: What would make this more useful for your role? What are you wishing you could see that isn't there? We're actively building and your input directly shapes what gets added.

4. GENERAL EXPERIENCE: Is it fast enough? Easy to navigate? Confusing anywhere? All feedback is welcome.

Please do not share your login credentials with anyone outside GYC. This dashboard contains confidential company and client data.

`;

// Build full document text
const fullText = [
  'GYC KPI Dashboard — Beta Launch Invitations\n\n',
  ...team.map(m =>
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Hi ${m.name},\n\n` +
    `You're invited to the GYC KPI Dashboard — our new real-time performance intelligence tool. ` +
    `This gives the team visibility into GYC's key metrics across Finance, Sales, Client Services, and more.\n\n` +
    `Dashboard URL: ${DASHBOARD_URL}\n` +
    `Login: ${m.email}\n` +
    `Password: ${PASSWORD}\n\n` +
    `${m.note}\n\n` +
    betaBody +
    `Thanks for being part of this launch.\n` +
    `— Todd\n\n`
  )
].join('');

// Get current doc end index
const docRes = await docs.documents.get({ documentId: DOC_ID });
const endIndex = docRes.data.body.content.reduce((max, el) => {
  return el.endIndex ? Math.max(max, el.endIndex) : max;
}, 1);

const batchRequests = [];

if (endIndex > 2) {
  batchRequests.push({
    deleteContentRange: {
      range: { startIndex: 1, endIndex: endIndex - 1 }
    }
  });
}

batchRequests.push({
  insertText: { location: { index: 1 }, text: fullText }
});

await docs.documents.batchUpdate({
  documentId: DOC_ID,
  requestBody: { requests: batchRequests },
});

console.log(`✅ Updated ${team.length} invites with beta launch messaging`);
