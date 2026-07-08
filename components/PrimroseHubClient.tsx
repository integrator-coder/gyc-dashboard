'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Phone, Star, Users, Target, TrendingUp, Calendar, CheckCircle2, Circle } from 'lucide-react';

// Import Google Fonts
const fontImport = `
@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,200;0,400;0,600;0,700&family=Poppins:wght@300;400;500;600&display=swap');

/* Force strong contrast within Primrose hub — overrides inherited text-white from dark app shell */
.primrose-hub-root { color: #111827; }
.primrose-hub-root p,
.primrose-hub-root li,
.primrose-hub-root span,
.primrose-hub-root td,
.primrose-hub-root th,
.primrose-hub-root label { color: inherit; }
.primrose-hub-root .text-gray-400 { color: #4b5563 !important; }
.primrose-hub-root .text-gray-500 { color: #374151 !important; }
.primrose-hub-root .text-gray-600 { color: #1f2937 !important; }
.primrose-hub-root .text-gray-700 { color: #111827 !important; }
.primrose-hub-root .text-gray-800 { color: #0f172a !important; }
.primrose-hub-root .text-gray-900 { color: #030712 !important; }
.primrose-hub-root .text-white { color: #ffffff !important; }
.primrose-hub-root .text-sm { font-size: 0.875rem; }
.primrose-hub-root .text-xs { font-size: 0.75rem; }
`;

const locations = [
  {
    id: 318,
    acronym: 'PSB',
    name: 'Burlington',
    city: 'Burlington, MA',
    address: '10 Greenleaf Way, Burlington, MA 01803',
    phone: '(781) 265-4400',
    website: 'https://www.primroseschools.com/schools/burlington',
    aclUrl: '/clients/PSB',
    gbpMapUrl: 'https://maps.google.com/?cid=ChIJj1tbJayf44kRNLCHGndhtP4',
    notionUrl: 'https://notion.so/329ca865-e197-813f-83cf-f7186db7525b',
    gbpRating: 4.8,
    gbpReviews: 37,
    enrolled: 99,
    capacity: 177,
    target: 160,
    tuitionTier: 'high',
    targetMarkets: [
      { name: 'Burlington', income: 146436, asian: 14.5, degree: 58.2, censusUrl: 'https://www.census.gov/quickfacts/burlingtontownmassachusetts' },
      { name: 'Lexington', income: 219402, asian: 33.0, degree: 85.0, censusUrl: 'https://www.census.gov/quickfacts/lexingtontownmassachusetts' },
      { name: 'Bedford', income: 172400, asian: 18.0, degree: 69.0, censusUrl: 'https://www.census.gov/quickfacts/bedfordtownmassachusetts' }
    ],
    messagingAngle: 'Reputation recovery + academic excellence positioning. Target Lexington/Bedford families (wealthy, education-focused, heavy Asian/Indian demographics). Overcome "too far" perception.',
    primaryChallenge: 'Word-of-mouth broke down under bad principal era. Culture recovered, enrollment hasn\'t.',
    notes: 'Had a bad principal a couple years ago — damaged culture, killed word-of-mouth. New principal in place, culture recovered, but referrals never bounced back. Lexington parents (10 min away) think Burlington is "too far." Asian/Indian families major segment.',
    services: ['SEO', 'Command', 'Blueprint', 'PaidMedia']
  },
  {
    id: 16393,
    acronym: 'PSW',
    name: 'Woburn',
    city: 'Woburn, MA',
    address: '168 Lexington St, Woburn, MA 01801',
    phone: '(781) 497-8388',
    website: 'https://www.primroseschools.com/schools/woburn',
    aclUrl: '/clients/PSB',  // All 3 locations consolidated under PSB
    gbpMapUrl: 'https://maps.google.com/?cid=ChIJIdEq_A5144kRIaz6fS1gIrQ',
    notionUrl: null,
    gbpRating: 5.0,
    gbpReviews: 19,
    enrolled: 131,
    capacity: 177,
    target: 160,
    tuitionTier: 'high',
    targetMarkets: [
      { name: 'Woburn', income: 111185, asian: 8.5, degree: 45.4, censusUrl: 'https://www.census.gov/quickfacts/woburnmassachusetts' },
      { name: 'Winchester', income: 218176, asian: 15.7, degree: 78.4, censusUrl: 'https://www.census.gov/quickfacts/winchestertownmassachusetts' }
    ],
    messagingAngle: 'Elite/status framing for Winchester families (social prestige motivation, not academic). Quality + safety + reliability for Woburn base.',
    primaryChallenge: 'Opened during COVID. Building awareness in a blue-collar town while targeting affluent Winchester.',
    notes: 'Opened during COVID. Town itself is blue-collar — majority of students from Winchester (wealthier neighbor). Winchester families less motivated by academics, more by social status — "elite," "superior offer" messaging works.',
    services: ['SEO', 'Command', 'Blueprint', 'PaidMedia']
  },
  {
    id: 16394,
    acronym: 'PSC',
    name: 'Chelmsford',
    city: 'Chelmsford, MA',
    address: '205 North Rd, Chelmsford, MA 01824',
    phone: '(978) 710-6123',
    website: 'https://www.primroseschools.com/schools/chelmsford',
    aclUrl: '/clients/PSB',  // All 3 locations consolidated under PSB
    gbpMapUrl: 'https://maps.google.com/?cid=ChIJv_ITEUGj44kR-63MQdAwZ-Y',
    notionUrl: null,
    gbpRating: 4.5,
    gbpReviews: 37,
    enrolled: 136,
    capacity: 177,
    target: 160,
    tuitionTier: 'lower',
    targetMarkets: [
      { name: 'Chelmsford', income: 140519, asian: 9.1, degree: 54.6, censusUrl: 'https://www.census.gov/quickfacts/chelmsfordtownmassachusetts' },
      { name: 'Westford', income: 187198, asian: 21.7, degree: 72.0, censusUrl: 'https://www.census.gov/quickfacts/westfordtownmassachusetts' }
    ],
    messagingAngle: 'Value + quality balance. Price-conscious messaging for Chelmsford base. Premium academic framing for Westford expansion.',
    primaryChallenge: 'Maintaining momentum under new ownership (acquired 2.5yr ago). Different community culture. Price-sensitive market.',
    notes: 'Purchased by Kate ~2.5yr ago from another Primrose franchisee. Different culture/community — required adjustment. Chelmsford families (blue-collar) fill the school; Westford (wealthier) is expansion target. Lower tuition tier than Burlington/Woburn.',
    services: ['SEO', 'Command', 'Blueprint', 'PaidMedia']
  }
];

const calls = [
  {
    date: 'June 23, 2026',
    type: 'Corporate C-Suite Pitch',
    attendees: 'Sebastian Estrada (GYC), Bruce Spurr (GYC CEO), Kate Latham, Rachel Van Emon, Greg Foglesong (CCO, Primrose Corporate), Andrea Freeman (VP Marketing, Primrose Corporate)',
    duration: '114 minutes',
    summary: 'The pivotal meeting. Kate organized this introduction between GYC and Primrose corporate executives. Functioned as a full pitch without being framed as one. Bruce walked through the Reputation Engine thesis, market math, AI/SEO strategy, and paid ads. Kate shared Drive agency benchmarks that GYC used to destroy the competition in real time.',
    topics: [
      { heading: 'Reputation Engine Thesis (40+ minutes)', detail: 'Bruce walked Greg and Andrea through the full GYC playbook: 45+ reviews is game-changing (market avg is 28-29). 100+ reviews lets clients cut media spend in half or eliminate it. Below 4.2 stars, ChatGPT ignores you. Tour conversion: 30-40% for logistical tours vs. 90% for relationship-based campus visits. Market math: 25,000 people = 1,400 kids aged 0-4, with 4-6% actively looking at any given time.' },
      { heading: 'Competitive Benchmark Revealed', detail: 'Kate shared Drive agency results: 25 million impressions, 489 clicks across 31 schools at $2,100/month average. That is $107/click. Bruce: "That\'s insane. You might have gotten 5 leads at $10,000 per lead." This single data point destroyed Drive and Eulerity\'s credibility in front of Primrose\'s own CCO. Kate confirmed GYC\'s stats "far exceeded" both pilot agencies.' },
      { heading: 'AI & SEO Strategy', detail: 'Greg asked pointed questions about AI optimization. Bruce explained: what ranked on Google Maps overlaps 60-80% with what AI platforms look for. AI emphasizes trust signals over keywords. First-mover advantage is significant and hard to displace. Key AI platforms: ChatGPT (dominant), Google Summaries/Gemini, Perplexity, Claude. 8 key directories still matter (Yellow Pages included). Schema markup, Apple Maps citations, and review velocity are critical.' },
      { heading: 'Paid Ads Pivot', detail: 'Meta ad costs have surged (GYC average: $1/click to $14/click industry-wide). Google Search ads being phased out. GYC pivoting to Google Local Service Ads (pay-per-lead, phone-heavy) and Meta for engagement. $10-15/day Meta budget for influence; $50-80/day for conversion campaigns. AI-generated creative discussed (including AI children imagery).' },
      { heading: 'Corporate Access Constraints', detail: 'Kate and Rachel have no direct GBP access (goes through Yext or corporate contact Katie). No website backend access. Google Ads managed by Primrose corporate (soon to be outsourced). Facebook/Instagram access is page-level only. Corporate controls brand, copy, and platforms across 590 locations.' },
      { heading: 'Brand Exclusivity Question', detail: 'Andrea (VP Marketing) raised concern: "We don\'t like agencies working with competitors." Bruce positioned GYC as brand-compliant and franchisee-focused. GYC has worked with Goddard, Kiddie Academy, Lightbridge, and other national brands — experience handling brand standards.' },
      { heading: "Sebastian's Technical Close", detail: 'At the end, Sebastian gave Greg exactly what he needed for the Friday dinner with Kate/Rachel: (1) Manager access to Google Business Profile for daily posting, review responses, and local connections. (2) Admin access to Google Ads accounts or permission to create new ones funded by franchisees. (3) Permission to add schema code to location websites for AI optimization.' },
    ],
    quotes: [
      '"The stats you shared today far exceed what they saw from the two pilots they just finished." — Kate Latham',
      '"I am hook, line, and sinker interested now in seeing what else we can do." — Rachel Van Emon',
      '"Every client we\'ve ever had that\'s gotten to 100+ reviews has been able to cut their media cost in half or more." — Bruce Spurr',
      '"$107 a click. That\'s insane! That\'s terrible. You might have gotten 5 leads at $10,000 per lead." — Bruce Spurr',
    ],
    actionItems: [
      { text: 'Kate/Rachel: Friday June 27 dinner with Greg to discuss the 3 access asks', done: true },
      { text: 'Sebastian: Send reviews generation + response playbooks to Kate', done: false },
      { text: 'Follow-up meeting week of July 10 to discuss expanded services and bundled pricing', done: true },
    ]
  },
  {
    date: 'June 29/30, 2026',
    type: 'Core Package Upgrade + Corporate Pilot',
    attendees: 'Bruce Spurr (GYC CEO), Sebastian Estrada (GYC), Kate Latham, Rachel Van Emon',
    duration: '53 minutes',
    summary: 'The upgrade call. Kate and Rachel committed to Core package for all 3 locations ($2,398/mo, 6-month commitment, July 1 start). Kate volunteered her locations as the Primrose corporate pilot — unprompted. Bruce committed to contact Greg that day. Co-op deadline (July 1) created the urgency GYC needed.',
    topics: [
      { heading: 'Core Package Details Confirmed', detail: 'Includes: SEO/AIO, heat maps, GBP optimization, Meta ad campaign management (GYC creates templates, Kate approves, GYC runs), M3 platform (automated tasks, brand studio, competitive analysis, weekly heat maps, teammate access), Blueprint training (ad creative, monthly workshops, tour sales training, GBP management, email campaigns), daily GBP posting (pending access), photo optimization and auto-tagging, Facebook/Instagram posting automation (mid-August), Meta ad automation (mid-late September), email campaign templates to activate 3,500+ lead database. Does NOT include media budgets (Kate pays Meta directly). Recommended Meta: $450/mo per location.' },
      { heading: 'Primrose Co-Op Shutdown (Key Timing)', detail: 'Primrose\'s market-level business co-op ends July 1. Franchisees must choose from two approved agencies (Drive and Eulerity) — both of which Kate/Rachel are dissatisfied with based on their terrible results. Kate does not want to wait for Primrose corporate to approve a third option and is moving with GYC regardless.' },
      { heading: 'Kate Volunteers the Pilot', detail: 'Kate: "Let us be the pilot. Give them some management access, and then you can see what it does for us." Kate volunteered her 3 locations as GYC\'s pilot with Primrose corporate (590 schools). GYC did not have to ask. She did it herself. This is the result of trust built over ~18 months.' },
      { heading: 'GBP Access Strategy', detail: 'No direct GBP access. Workaround: manual posting via Katie (Primrose corporate contact) until corporate grants manager access. Plan is to make this annoying enough that Kate makes the direct ask to corporate. Kate willing to say: "Here\'s what we need, here\'s why, here\'s the value." Bruce to contact Greg directly with heat map results.' },
      { heading: 'Kate\'s Advice to Bruce on Approaching Greg', detail: '"I wouldn\'t come at them with the ask. Just be an offer of help. Here\'s what we can do for you guys. Here\'s what we\'ve already done for us. You guys have the results." Don\'t lead with GBP access request. Lead with value, heat maps, results, pilot offer.' },
      { heading: 'Budget Concern Flagged', detail: 'Kate concerned about Meta budget: current $450/mo total across all locations vs. recommended $450/mo per location. Resolved by agreeing to start at current budget and scale as results come in. Realistic projection: 3-12 enrollments per month from paid ads.' },
      { heading: 'Other Platform Access', detail: 'Yext: Kate granted Sebastian access (pushes to all directories except Manta). Bing and Apple Maps controlled by corporate. Bruce wants Kate to claim Bing directly (important for ChatGPT search). Facebook/Instagram: page-level access only, Kate runs ads via personal account.' },
    ],
    quotes: [
      '"Let us be the pilot. Give them some management access, and then you can see what it does for us." — Kate Latham',
      '"I wouldn\'t come at them with the ask. Just be an offer of help." — Kate Latham (advising Bruce on Greg)',
      '"I don\'t care if I can track it. I need to fill my schools, and one of them isn\'t, and that\'s the one we\'re working with you on." — Rachel Van Emon',
    ],
    actionItems: [
      { text: 'Bruce contact Greg (Primrose corporate) TODAY', done: true },
      { text: 'Core package agreement sent to Kate/Rachel (all 3 locations, July 1 start)', done: true },
      { text: 'Check Yext capabilities now that Sebastian has access', done: true },
      { text: 'Kate/Rachel: Review budgets and decide on Meta spend per location', done: true },
      { text: 'Kate: Make direct ask to Primrose corporate for GBP manager access', done: false },
    ]
  },
  {
    date: 'July 7, 2026',
    type: 'Blueprint Onboarding',
    attendees: 'Zu Vuong (GYC Blueprint), Sebastian Estrada (GYC Web/SEO), Kate Latham, Rachel Van Emon',
    duration: '50+ minutes',
    summary: 'First formal Blueprint onboarding session post-upgrade. Zu ran the Done With You kickoff while Sebastian simultaneously set up Facebook/Instagram access. Full enrollment mapping, geographic targeting, demographic strategy. Referral program and email gaps identified.',
    topics: [
      { heading: 'Enrollment Numbers (Current)', detail: 'Burlington: 99/177 (56% — #1 priority, largest gap). Woburn: 131/177 (74%). Chelmsford: 136/177 (77%). All 3 targeting 160 students (90% capacity). Total gap: 114 students across 531 total capacity. Note: July numbers slightly inflated — kids leaving end of August not yet counted. September numbers will be lower.' },
      { heading: 'Burlington Context', detail: 'Had a bad principal 2-3 years ago who damaged culture. Has since been replaced. New principal in place, happy teachers, happy families — culture has fully recovered. BUT word-of-mouth never recovered. Previously, word of mouth was what kept Burlington full. Families stopped recommending during bad principal era. That trust has not been rebuilt enough to fill the school. Lexington parents (10 min away) perceive Burlington as too far — a geography/awareness problem.' },
      { heading: 'Geographic Targeting by Location', detail: 'Burlington targets: Bedford and Lexington (wealthy, white-collar, education-focused, heavy Asian/Indian demographics). Woburn targets: Winchester primarily (wealthier neighbor, majority of current students), plus Lexington and Woburn. Winchester families motivated by social status/prestige rather than academic outcomes — "elite" framing. Chelmsford targets: Chelmsford itself (blue-collar base fills school), expanding into Westford (wealthier neighbor). Also markets to Billerica and Lowell.' },
      { heading: 'Demographics & Target Audience', detail: 'Large Asian and Indian population across all 3 schools. Lexington school system now 40% Asian — families moving in specifically for school quality. Winchester also heavily Asian. Rachel example: Indian family visited 8+ centers, came with notebook of questions, chose Primrose at $3,488/month. Win factors: cleanliness, quality, reliability. No scholarships, no sliding scale. Primrose targets families who can afford full tuition. Typically most expensive childcare in their markets.' },
      { heading: 'Why Families Choose Primrose', detail: 'Academic/character development outcomes (primary). Reliability — never closes last minute (competitors do). On-site chef, all meals provided. Uniforms (zero parent mental load). Large, bright, clean classrooms (increasingly cited in tours). Prestige/status (Winchester). Higher education values (Asian/Indian families). High-demand working parents (surgeons, executives) who need certainty.' },
      { heading: 'Meta Ads Setup (In Progress)', detail: 'Each location has its own Facebook page and ad account. Kate manages all ad accounts personally — corporate does national ads only. Pages claimed by Primrose corporate portfolio. Kate uses personal account to run ads. Sebastian successfully added to Burlington Facebook assets. Zu accepted Burlington page invite. Production team lead not yet added. Woburn and Chelmsford access still in progress. Facebook Pixel status: UNKNOWN — Kate does not know if one is installed.' },
      { heading: 'Email & Lead Nurture', detail: 'Using ProCare for both existing families and leads. Sending to leads minimum 1x/week. Content mix: developmental/educational content (potty training tips, parenting resources) alternating with enrollment CTAs (open houses, event invitations). Zu recommendation: always include a soft enrollment CTA even in educational emails. No campaigns currently going to existing families — opportunity to activate.' },
      { heading: 'Referral Program', detail: 'Exists on paper but has never been launched or marketed. Rachel: "I will give away a thousand bucks." Zu to share Bruce\'s referral program presentation as starting framework. Best timing: back-to-school season when families are settling into routines.' },
      { heading: 'Promotions Strategy', detail: 'No widespread discounts or limited-time offers. Partner group perk: registration fee waived for members of certain parent groups. Zu suggestion: referral program launch as the first formal promotion — easy win for fall.' },
    ],
    quotes: [
      '"Burlington had a bad principal a couple years ago — damaged culture, killed word-of-mouth. Culture recovered, but referrals never bounced back." — Kate Latham',
      '"Lexington school system is now 40% Asian — families moving in specifically for school quality." — Rachel Van Emon',
      '"I\'ll give away a thousand bucks." — Rachel Van Emon on launching referral program',
      '"Coming from a Vietnamese background, that was for us too — quality over everything. It\'s an investment." — Zu Vuong',
    ],
    actionItems: [
      { text: 'Complete Woburn + Chelmsford Facebook page/ad account access', done: false },
      { text: 'Investigate whether Facebook Pixel is installed on any location', done: false },
      { text: 'Zu: Share Bruce\'s referral program presentation with Kate/Rachel', done: false },
      { text: 'Zu: Walk Kate through M3 workspace features module (next session)', done: false },
      { text: 'Kate: Provide "what parents value" list per location for creative', done: false },
      { text: 'Zu: Email campaign review + add persistent enrollment CTA', done: false },
    ]
  },
];
export default function PrimroseHubClient() {
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [brandGuideOpen, setBrandGuideOpen] = useState(true);
  const [creativeStandardsOpen, setCreativeStandardsOpen] = useState(false);
  const [facebookTemplatesOpen, setFacebookTemplatesOpen] = useState(false);
  const [instagramTemplatesOpen, setInstagramTemplatesOpen] = useState(false);
  const [expandedCall, setExpandedCall] = useState<number | null>(null);
  const [clientOpsOpen, setClientOpsOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(true);

  const totalEnrolled = locations.reduce((sum, loc) => sum + loc.enrolled, 0);
  const totalCapacity = locations.reduce((sum, loc) => sum + loc.capacity, 0);
  const totalTarget = locations.reduce((sum, loc) => sum + loc.target, 0);
  const totalGap = totalTarget - totalEnrolled;
  const avgRating = (locations.reduce((sum, loc) => sum + loc.gbpRating, 0) / locations.length).toFixed(1);

  const getEnrollmentColor = (pct: number) => {
    if (pct < 65) return 'bg-red-500';
    if (pct < 90) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getEnrollmentBarColor = (pct: number) => {
    if (pct < 65) return 'bg-red-400';
    if (pct < 90) return 'bg-yellow-400';
    return 'bg-green-400';
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: fontImport }} />
      <div className="primrose-hub-root min-h-screen bg-white" style={{ fontFamily: 'Poppins, sans-serif', color: '#111827' }}>
        {/* Header */}
        <div className="bg-[#5e6738] text-white py-8 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-4xl font-bold" style={{ fontFamily: 'Source Serif 4, serif' }}>
                PRIMROSE SCHOOLS
              </h1>
              <span className="bg-[#ff9e1b] text-white px-4 py-2 rounded-full text-sm font-semibold">
                PILOT — HIGH PRIORITY
              </span>
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem',flexWrap:'wrap',gap:10}}>
              <p className="text-lg" style={{margin:0}}>Brand Intelligence Hub</p>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <a href="/clients/PSB" style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.2)',color:'#fff',padding:'6px 14px',borderRadius:8,textDecoration:'none',fontSize:13,fontWeight:600,border:'1px solid rgba(255,255,255,0.3)'}}>
                  📋 Full Client Card (PSB)
                </a>
                <a href="/primrose/journey" style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(255,158,27,0.3)',color:'#fff',padding:'6px 14px',borderRadius:8,textDecoration:'none',fontSize:13,fontWeight:600,border:'1px solid rgba(255,158,27,0.5)'}}>
                  📖 Journey Page
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <div className="text-white/70">Contact</div>
                <div className="font-semibold">Kate Latham</div>
              </div>
              <div>
                <div className="text-white/70">Locations</div>
                <div className="font-semibold">{locations.length} • Massachusetts</div>
              </div>
              <div>
                <div className="text-white/70">Total Capacity</div>
                <div className="font-semibold">{totalCapacity} students</div>
              </div>
              <div>
                <div className="text-white/70">Current Enrollment</div>
                <div className="font-semibold">{totalEnrolled} ({Math.round((totalEnrolled / totalCapacity) * 100)}%)</div>
              </div>
              <div>
                <div className="text-white/70">Gap to Target</div>
                <div className="font-semibold">{totalGap} students</div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <Star className="w-4 h-4 fill-current" />
              <span className="font-semibold">Avg GBP: {avgRating}★</span>
            </div>
          </div>
        </div>

        {/* Quick Nav Bar */}
        <div style={{ background: '#f0f3e8', borderBottom: '1px solid #d4d9c4', padding: '0.75rem 1.5rem' }}>
          <div className="max-w-7xl mx-auto" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#5e6738' }}>QUICK LINKS:</span>
            <a href="/clients/PSB" style={{fontSize:13,fontWeight:700,color:'#fff',background:'#374151',padding:'4px 14px',borderRadius:6,textDecoration:'none',display:'flex',alignItems:'center',gap:6}}>📋 Client Card</a>
            <a href="#opportunity" style={{ fontSize: 13, color: '#374151', textDecoration: 'none', padding: '4px 12px', background: '#fff', border: '1px solid #d4d9c4', borderRadius: 6 }}>The Opportunity</a>
            <a href="#brand-guide" style={{ fontSize: 13, color: '#374151', textDecoration: 'none', padding: '4px 12px', background: '#fff', border: '1px solid #d4d9c4', borderRadius: 6 }}>Brand Guide</a>
            <a href="#creative" style={{ fontSize: 13, color: '#374151', textDecoration: 'none', padding: '4px 12px', background: '#fff', border: '1px solid #d4d9c4', borderRadius: 6 }}>Creative Standards</a>
            <a href="#locations" style={{ fontSize: 13, color: '#374151', textDecoration: 'none', padding: '4px 12px', background: '#fff', border: '1px solid #d4d9c4', borderRadius: 6 }}>Locations</a>
            <a href="#calls" style={{ fontSize: 13, color: '#374151', textDecoration: 'none', padding: '4px 12px', background: '#fff', border: '1px solid #d4d9c4', borderRadius: 6 }}>Call History</a>
            <a href="/primrose/journey" style={{ fontSize: 13, fontWeight: 700, color: '#fff', textDecoration: 'none', padding: '4px 14px', background: '#5e6738', border: '1px solid #5e6738', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              📖 Full Journey →
            </a>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* The Opportunity */}
          <div id="opportunity" className="border border-[#e8eadf] rounded-lg overflow-hidden">
            <button
              onClick={() => setOpportunityOpen(!opportunityOpen)}
              className="w-full flex items-center justify-between p-6 bg-white hover:bg-gray-50 transition-colors"
            >
              <h2 className="text-2xl font-bold text-[#5e6738]" style={{ fontFamily: 'Source Serif 4, serif' }}>
                The Opportunity
              </h2>
              {opportunityOpen ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
            </button>
            {opportunityOpen && (
              <div className="p-6 pt-0" style={{display:'flex',flexDirection:'column',gap:20}}>

                {/* Who They Are */}
                <div style={{background:'#f0f3e8',borderLeft:'4px solid #5e6738',padding:'1rem 1.25rem',borderRadius:'0 8px 8px 0'}}>
                  <div style={{fontFamily:'Source Serif 4, serif',fontWeight:700,fontSize:18,color:'#5e6738',marginBottom:8}}>Who Primrose Schools Is</div>
                  <p style={{fontSize:14,color:'#1f2937',lineHeight:1.7,margin:'0 0 10px'}}>
                    Primrose School Franchising Company is the <strong>#1 ranked childcare franchise in America</strong> — Entrepreneur Franchise 500 for 18 consecutive years, including 6 straight years at #1 in the childcare category. They operate <strong>558 franchised schools</strong> across 34 states and Washington DC, with 40+ new schools opening in 2025 alone and 200+ in the development pipeline. Total enrollment exceeds <strong>100,000 children</strong>.
                  </p>
                  <p style={{fontSize:14,color:'#1f2937',lineHeight:1.7,margin:0}}>
                    Primrose is <strong>owned by Roark Capital</strong> (the PE firm behind Arby's, Buffalo Wild Wings, and Sonic) since 2008. In 2024, Roark explored a sale at a <strong>$2B+ valuation</strong> — a signal of just how valuable and defensible this brand is. System-wide revenue runs approximately <strong>$1.4–1.6 billion annually</strong>.
                  </p>
                </div>

                {/* Stat Cards */}
                <style>{`
                  .stat-card { position: relative; cursor: default; }
                  .stat-card .stat-tip {
                    display: none;
                    position: absolute;
                    bottom: calc(100% + 8px);
                    left: 50%;
                    transform: translateX(-50%);
                    background: #1f2937;
                    color: #f9fafb;
                    font-size: 12px;
                    line-height: 1.5;
                    padding: 8px 12px;
                    border-radius: 6px;
                    width: 220px;
                    z-index: 50;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    pointer-events: none;
                  }
                  .stat-card .stat-tip::after {
                    content: '';
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    border: 6px solid transparent;
                    border-top-color: #1f2937;
                  }
                  .stat-card:hover .stat-tip { display: block; }
                `}</style>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12}}>
                  {[
                    ['558', 'Franchised Schools', 'Individual Primrose locations currently open under active franchise agreements. Each is independently owned and operated by a franchisee who pays royalties and fees to corporate Primrose.'],
                    ['34 States + DC', 'Geographic Reach', 'Number of U.S. states where at least one Primrose school is currently operating. Concentration is highest in Southeast and Mid-Atlantic, with expansion into Midwest and West.'],
                    ['100,000+', 'Children Enrolled', 'Estimated total number of children currently attending Primrose schools across all 558 locations. This is across infants through kindergarten and after-schoolers.'],
                    ['$1.4–1.6B', 'System Revenue (est.)', 'Total annual revenue generated across ALL 558 Primrose locations combined. This is franchisee tuition revenue — not corporate revenue. Corporate earns 7% royalty + 4–5% marketing fees on top of this.'],
                    ['$2B+', '2024 Valuation Explored', 'In 2024, owner Roark Capital explored selling Primrose at an estimated $2B+ enterprise valuation. This reflects the value of the brand, franchise agreements, and royalty stream — not individual school assets.'],
                    ['#1 × 6', 'Entrepreneur Franchise 500', 'Primrose has been ranked #1 in the childcare category of Entrepreneur Magazine’s Franchise 500 for 6 consecutive years, and has appeared on the overall list for 18 consecutive years. One of the most prestigious franchise rankings in the industry.'],
                    ['$2.65M', 'Avg Unit Revenue', 'Average annual gross revenue earned by a single Primrose school location, per the 2025 Franchise Disclosure Document (FDD). Median is $2.4M. Top quartile schools earn $3.6M+. Kate’s Burlington location is likely in the $2M–3M range.'],
                    ['200+', 'Schools in Pipeline', 'Signed franchise agreements for new Primrose schools currently in development — being designed, permitted, built, or staffed — but not yet open. Represents near-term network growth. Different from the 558 that are already operating.'],
                  ].map(([v, l, tip]) => (
                    <div key={l} className="stat-card" style={{background:'#fff',border:'1px solid #e8eadf',borderRadius:8,padding:'12px 14px',textAlign:'center'}}>
                      <div className="stat-tip">{tip}</div>
                      <div style={{fontWeight:700,fontSize:20,color:'#5e6738'}}>{v}</div>
                      <div style={{fontSize:11,color:'#374151',marginTop:2}}>{l}</div>
                      <div style={{fontSize:10,color:'#9ca3af',marginTop:3}}>hover for definition</div>
                    </div>
                  ))}
                </div>

                {/* Leadership */}
                <div style={{background:'#fff',border:'1px solid #e8eadf',borderRadius:8,padding:'1rem 1.25rem'}}>
                  <div style={{fontWeight:700,fontSize:14,color:'#111827',marginBottom:10}}>CORPORATE LEADERSHIP</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
                    {[
                      ['David P. Berg', 'CEO', 'Joined 2019'],
                      ['Greg Foglesong', 'Chief Commercial Officer', 'Joined Feb 2026 — our contact. Retail/e-commerce background. Digital-forward.'],
                      ['Andrea Freeman', 'VP of Marketing', 'Our contact. On the June 23 call. Controls approved vendor decisions.'],
                    ].map(([name, title, note]) => (
                      <div key={name} style={{background:'#f8f9f5',borderRadius:6,padding:'10px 12px'}}>
                        <div style={{fontWeight:700,fontSize:13,color:'#111827'}}>{name}</div>
                        <div style={{fontSize:12,color:'#5e6738',fontWeight:600,marginBottom:4}}>{title}</div>
                        <div style={{fontSize:11,color:'#374151'}}>{note}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Market Position */}
                <div style={{background:'#fff',border:'1px solid #e8eadf',borderRadius:8,padding:'1rem 1.25rem'}}>
                  <div style={{fontWeight:700,fontSize:14,color:'#111827',marginBottom:10}}>MARKET POSITION</div>
                  <p style={{fontSize:13,color:'#374151',lineHeight:1.65,margin:'0 0 10px'}}>
                    Primrose plays in the <strong>premium tier only</strong> — competing with Goddard School and Bright Horizons, not KinderCare or La Petite. Tuition ranges from <strong>$1,850–$2,950/month nationally</strong> vs. $1,200–$1,650 national average. Target family profile: <strong>median household income $150K+</strong>, suburban, dual-income, education-focused. Kate's Burlington location charges up to $3,488/month for infant care — among the highest in their portfolio.
                  </p>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:6,padding:'8px 12px'}}>
                      <div style={{fontWeight:600,fontSize:12,color:'#166534',marginBottom:4}}>BRAND PRESTIGE</div>
                      <ul style={{margin:0,paddingLeft:16,fontSize:12,color:'#15803d',lineHeight:1.8}}>
                        <li>Entrepreneur Franchise 500 — 18 consecutive years</li>
                        <li>FRANdata FUND Score: 930 (elite tier)</li>
                        <li>Newsweek #1 — Child Care Customer Service</li>
                        <li>Cognia-accredited system-wide</li>
                      </ul>
                    </div>
                    <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:6,padding:'8px 12px'}}>
                      <div style={{fontWeight:600,fontSize:12,color:'#1e40af',marginBottom:4}}>UNIT ECONOMICS (2025 FDD)</div>
                      <ul style={{margin:0,paddingLeft:16,fontSize:12,color:'#1d4ed8',lineHeight:1.8}}>
                        <li>Avg revenue: $2.65M | Median: $2.4M</li>
                        <li>EBITDA: $265K–$475K (top quartile: $769K)</li>
                        <li>7% royalty + 4–5% marketing fees</li>
                        <li>Investment: $742K–$8.6M per school</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Digital Marketing Landscape */}
                <div style={{background:'#fff',border:'1px solid #e8eadf',borderRadius:8,padding:'1rem 1.25rem'}}>
                  <div style={{fontWeight:700,fontSize:14,color:'#111827',marginBottom:10}}>WHO'S CURRENTLY DOING THEIR MARKETING</div>
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {[
                      {
                        name: 'Digital Spice',
                        type: 'SEO — PILOT (~50 schools)',
                        color: '#166534', bg: '#f0fdf4', border: '#bbf7d0',
                        detail: 'Franchise-focused SEO agency. Currently piloting with approximately 50 Primrose schools on metro-level SEO architecture. Case study: 18 childcare centers achieving top-of-pack performance. Estimated $1,500–$2,500/month per location. GYC is positioned to compete directly against this as a pilot expands.'
                      },
                      {
                        name: 'Drive Social Media',
                        type: 'APPROVED VENDOR — Paid Social, Search, Video, Email',
                        color: '#92400e', bg: '#fffbeb', border: '#fde68a',
                        detail: 'One of two approved franchise vendors for paid advertising. 1,000+ franchise partners. IFA-listed supplier. On the June 23 call, Kate revealed their Primrose results: 25M impressions, 489 clicks across 31 schools at $2,100/month = $107/click. Bruce called it insane. Kate confirmed GYC stats far exceeded them.'
                      },
                      {
                        name: 'Eulerity',
                        type: 'APPROVED VENDOR — AI-Powered Marketing Automation',
                        color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe',
                        detail: 'AI-powered digital marketing platform. Omni-channel: search, social, display, video, OTT/CTV. Strong childcare results elsewhere (My Gym: 2.2x ROI, $0.77 CPC). But Kate and Rachel are dissatisfied with both Drive and Eulerity for Primrose. The co-op shutting July 1 forced franchisees to choose between them — which is exactly why Kate moved to GYC instead.'
                      },
                    ].map((vendor) => (
                      <div key={vendor.name} style={{background:vendor.bg,border:`1px solid ${vendor.border}`,borderRadius:8,padding:'10px 14px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                          <span style={{fontWeight:700,fontSize:14,color:vendor.color}}>{vendor.name}</span>
                          <span style={{fontSize:11,fontWeight:600,color:vendor.color,background:'rgba(0,0,0,0.06)',padding:'2px 8px',borderRadius:9999}}>{vendor.type}</span>
                        </div>
                        <p style={{fontSize:13,color:'#374151',margin:0,lineHeight:1.6}}>{vendor.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* The GYC Opportunity */}
                <div style={{background:'#fff',border:'2px solid #5e6738',borderRadius:8,padding:'1rem 1.25rem'}}>
                  <div style={{fontWeight:700,fontSize:14,color:'#5e6738',marginBottom:10}}>THE GYC OPPORTUNITY — BY THE NUMBERS</div>
                  <p style={{fontSize:13,color:'#374151',lineHeight:1.65,margin:'0 0 12px'}}>
                    If GYC becomes an approved vendor and achieves even modest penetration across the Primrose network, the revenue opportunity is transformational for the company.
                  </p>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10,marginBottom:12}}>
                    {[
                      ['30% penetration', '177 locations', '$424K/mo', '$5.09M/yr'],
                      ['20% penetration', '118 locations', '$283K/mo', '$3.44M/yr'],
                      ['Conservative 15%', '88 locations', '$211K/mo', '$2.53M/yr'],
                    ].map(([label, locs, mo, yr]) => (
                      <div key={label} style={{background:'#f0f3e8',borderRadius:6,padding:'10px 12px'}}>
                        <div style={{fontWeight:600,fontSize:12,color:'#5e6738',marginBottom:4}}>{label}</div>
                        <div style={{fontSize:13,color:'#111827'}}>{locs} • {mo}</div>
                        <div style={{fontWeight:700,fontSize:15,color:'#166534'}}>{yr}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:6,padding:'8px 12px'}}>
                    <div style={{fontWeight:600,fontSize:12,color:'#92400e',marginBottom:4}}>WHERE WE ARE NOW</div>
                    <p style={{fontSize:13,color:'#78350f',margin:0}}>Kate Latham’s 3 locations are the live pilot at $2,398/mo each = $7,194/mo. If results prove out, Bruce brings heat maps + data to Greg (CCO). Kate’s advice: “Lead with value, not the ask.” Greg joined Primrose in February 2026 from a retail/e-commerce background — he thinks digitally and responds to data.</p>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Brand Guide */}
          <div id="brand-guide" className="border border-[#e8eadf] rounded-lg overflow-hidden">
            <button
              onClick={() => setBrandGuideOpen(!brandGuideOpen)}
              className="w-full flex items-center justify-between p-6 bg-white hover:bg-gray-50 transition-colors"
            >
              <h2 className="text-2xl font-bold text-[#5e6738]" style={{ fontFamily: 'Source Serif 4, serif' }}>
                Brand Guide
              </h2>
              {brandGuideOpen ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
            </button>
            {brandGuideOpen && (
              <div className="p-6 pt-0 space-y-6">
                {/* Brand DNA */}
                <div className="bg-white border border-[#e8eadf] p-6 rounded-lg">
                  <h3 className="text-xl font-semibold mb-4 text-[#5e6738]" style={{ fontFamily: 'Source Serif 4, serif' }}>
                    Brand DNA
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <strong>Mission:</strong> To forge a path that leads to a brighter future for all children.
                    </div>
                    <div>
                      <strong>Vision:</strong> To deliver the best and most trusted early education and care for children and families across America.
                    </div>
                    <div>
                      <strong>Brand Persona:</strong> The Knowledgeable Nurturer
                    </div>
                    <div>
                      <strong>Four Attributes:</strong> Premium • Joyful • Educational • Inspirational
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <strong>Core Philosophy:</strong> Balanced Learning® → Active Minds, Healthy Bodies, Happy Hearts®
                    </div>
                  </div>
                </div>

                {/* Color Palette */}
                <div className="bg-white border border-[#e8eadf] p-6 rounded-lg">
                  <h3 className="text-xl font-semibold mb-4 text-[#5e6738]" style={{ fontFamily: 'Source Serif 4, serif' }}>
                    Color Palette
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#5e6738] border-2 border-gray-300" />
                      <div className="text-sm">
                        <div className="font-semibold">Primrose Green</div>
                        <div className="text-gray-600">#5e6738</div>
                        <div className="text-xs text-gray-500">PRIMARY — 30%</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#373a36] border-2 border-gray-300" />
                      <div className="text-sm">
                        <div className="font-semibold">Dark/Black</div>
                        <div className="text-gray-600">#373a36</div>
                        <div className="text-xs text-gray-500">Neutrals</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-white border-2 border-gray-300" />
                      <div className="text-sm">
                        <div className="font-semibold">White</div>
                        <div className="text-gray-600">#ffffff</div>
                        <div className="text-xs text-gray-500">DOMINANT — 50%</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#b9bcbc] border-2 border-gray-300" />
                      <div className="text-sm">
                        <div className="font-semibold">Gray</div>
                        <div className="text-gray-600">#b9bcbc</div>
                        <div className="text-xs text-gray-500">Neutrals</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#ff9e1b] border-2 border-gray-300" />
                      <div className="text-sm">
                        <div className="font-semibold">Orange</div>
                        <div className="text-gray-600">#ff9e1b</div>
                        <div className="text-xs text-gray-500">SECONDARY — 15%</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#814c9e] border-2 border-gray-300" />
                      <div className="text-sm">
                        <div className="font-semibold">Purple</div>
                        <div className="text-gray-600">#814c9e</div>
                        <div className="text-xs text-gray-500">SECONDARY — 15%</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#006ba6] border-2 border-gray-300" />
                      <div className="text-sm">
                        <div className="font-semibold">Blue</div>
                        <div className="text-gray-600">#006ba6</div>
                        <div className="text-xs text-gray-500">TERTIARY — 5%</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#00a5b5] border-2 border-gray-300" />
                      <div className="text-sm">
                        <div className="font-semibold">Turquoise</div>
                        <div className="text-gray-600">#00a5b5</div>
                        <div className="text-xs text-gray-500">TERTIARY — 5%</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#e03c31] border-2 border-gray-300" />
                      <div className="text-sm">
                        <div className="font-semibold">Red</div>
                        <div className="text-gray-600">#e03c31</div>
                        <div className="text-xs text-gray-500">TERTIARY — 5%</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-sm font-semibold mb-2">Usage Ratio</div>
                    <div className="flex h-8 rounded overflow-hidden">
                      <div className="bg-white border-r border-gray-300" style={{ width: '50%' }} />
                      <div className="bg-[#5e6738]" style={{ width: '30%' }} />
                      <div className="bg-[#ff9e1b]" style={{ width: '15%' }} />
                      <div className="bg-[#006ba6]" style={{ width: '5%' }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>50% white/neutral</span>
                      <span>30% green</span>
                      <span>15% secondary</span>
                      <span>5% tertiary</span>
                    </div>
                  </div>
                </div>

                {/* Typography */}
                <div className="bg-white border border-[#e8eadf] p-6 rounded-lg">
                  <h3 className="text-xl font-semibold mb-4 text-[#5e6738]" style={{ fontFamily: 'Source Serif 4, serif' }}>
                    Typography
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="text-3xl font-bold mb-2" style={{ fontFamily: 'Source Serif 4, serif' }}>
                        Source Serif Pro
                      </div>
                      <div className="text-sm text-gray-600">Web headlines (18pt minimum)</div>
                    </div>
                    <div>
                      <div className="text-xl font-normal mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Poppins
                      </div>
                      <div className="text-sm text-gray-600">Body copy and subheads</div>
                    </div>
                    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 text-sm">
                      <strong>Rules:</strong> Never ALL CAPS • Headline min 18pt • Title Case or Sentence case only
                    </div>
                  </div>
                </div>

                {/* Logo Rules */}
                <div className="bg-white border border-[#e8eadf] p-6 rounded-lg">
                  <h3 className="text-xl font-semibold mb-4 text-[#5e6738]" style={{ fontFamily: 'Source Serif 4, serif' }}>
                    Logo Rules
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 font-semibold">Logo Type</th>
                        <th className="text-left py-2 font-semibold">When to Use</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="py-2">Primary Logo</td>
                        <td className="py-2">Default — use as often as possible</td>
                      </tr>
                      <tr>
                        <td className="py-2">Primary Logo with Tagline</td>
                        <td className="py-2">Brand campaigns, key materials</td>
                      </tr>
                      <tr>
                        <td className="py-2">Circle Logo</td>
                        <td className="py-2">Limited space (email signatures, banner ads)</td>
                      </tr>
                      <tr>
                        <td className="py-2">Badge Logo</td>
                        <td className="py-2">Busy backgrounds or when green is lacking; signage</td>
                      </tr>
                      <tr>
                        <td className="py-2">Apparel Logo</td>
                        <td className="py-2">Clothing and branded merchandise ONLY</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-4 bg-red-50 border-l-4 border-red-500 p-4 text-sm">
                    <strong>Critical:</strong> Only green/black/white colors • Never alter proportion, color, or crop • Clear space = height of &quot;P&quot;
                  </div>
                </div>

                {/* Voice & Language */}
                <div className="bg-white border border-[#e8eadf] p-6 rounded-lg">
                  <h3 className="text-xl font-semibold mb-4 text-[#5e6738]" style={{ fontFamily: 'Source Serif 4, serif' }}>
                    Voice & Language Rules
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-green-700 mb-3">✅ Always Say</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• &quot;early education and care school&quot; (not daycare)</li>
                        <li>• &quot;children&quot; or &quot;child&quot; (not &quot;kids&quot;)</li>
                        <li>• &quot;Balanced Learning®&quot; with trademark</li>
                        <li>• Gender-neutral pronouns: they/them/their</li>
                        <li>• Title Case OR Sentence case</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-red-700 mb-3">❌ Never Say</h4>
                      <ul className="space-y-2 text-sm">
                        <li>• &quot;daycare&quot; — always &quot;early education and care&quot;</li>
                        <li>• &quot;kids&quot; — always &quot;children&quot;</li>
                        <li>• ALL CAPS headlines</li>
                        <li>• Ampersands in sentences (OK in titles/bullets)</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4 bg-orange-50 border-l-4 border-[#ff9e1b] p-4 text-sm">
                    <strong>Most Critical:</strong> NEVER say &quot;daycare&quot; in any Primrose ad copy, emails, or social posts — this is a brand violation
                  </div>
                </div>

                {/* Photography Standards */}
                <div className="bg-white border border-[#e8eadf] p-6 rounded-lg">
                  <h3 className="text-xl font-semibold mb-4 text-[#5e6738]" style={{ fontFamily: 'Source Serif 4, serif' }}>
                    Photography Standards
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li>• Shot at child&apos;s level — children in focus, backgrounds blurred</li>
                    <li>• Shallow depth of field (bokeh)</li>
                    <li>• Bright, airy, colorful environments</li>
                    <li>• Authentic, candid, joyful — NOT posed or stock</li>
                    <li>• <strong>NO stock photos</strong></li>
                  </ul>
                  <div className="mt-4 bg-blue-50 border-l-4 border-[#006ba6] p-4 text-sm">
                    <strong>GYC Note:</strong> Real classroom images required from Kate. Zac/production team must follow these standards.
                  </div>
                </div>

                {/* GYC Action Rules */}
                <div className="bg-amber-50 border border-[#ff9e1b] p-6 rounded-lg">
                  <h3 className="text-xl font-semibold mb-4 text-[#ff9e1b]" style={{ fontFamily: 'Source Serif 4, serif' }}>
                    GYC Action Rules (Team Checklist)
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1" />
                      <span>Primrose Green (#5e6738) is dominant color in all creative</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1" />
                      <span>Source Serif Pro for headlines (min 18pt), Poppins for body</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1" />
                      <span>NO &quot;daycare&quot; — only &quot;early education and care school&quot;</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1" />
                      <span>NO &quot;kids&quot; — only &quot;children&quot;</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1" />
                      <span>NO ALL CAPS in any headline</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1" />
                      <span>Real classroom photos from Kate (no stock images)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1" />
                      <span>Photos at child&apos;s level, bright/airy, shallow depth of field</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1" />
                      <span>&quot;Balanced Learning®&quot; with trademark symbol</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Creative Standards */}
          <div id="creative" className="border border-[#e8eadf] rounded-lg overflow-hidden">
            <button
              onClick={() => setCreativeStandardsOpen(!creativeStandardsOpen)}
              className="w-full flex items-center justify-between p-6 bg-white hover:bg-gray-50 transition-colors"
            >
              <h2 className="text-2xl font-bold text-[#5e6738]" style={{ fontFamily: 'Source Serif 4, serif' }}>
                CREATIVE STANDARDS — AD TEMPLATES
              </h2>
              {creativeStandardsOpen ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
            </button>
            {creativeStandardsOpen && (
              <div className="p-6 pt-0 space-y-6">
                {/* Hill Holliday Credit */}
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4">
                  <p className="text-sm font-semibold text-amber-900 mb-1">🏆 Hill Holliday Partnership</p>
                  <p className="text-sm text-amber-800">
                    These templates were developed with guidance from an SVP at Hill Holliday (Boston) who is a Primrose parent. 
                    They represent agency-level strategic architecture — GYC should extend this system, not replace it.
                  </p>
                </div>

                {/* Facebook Template System */}
                <div className="border border-[#e8eadf] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setFacebookTemplatesOpen(!facebookTemplatesOpen)}
                    className="w-full flex items-center justify-between p-4 bg-[#f8f9f5] hover:bg-gray-50 transition-colors"
                  >
                    <h3 className="text-lg font-bold text-[#5e6738]" style={{ fontFamily: 'Source Serif 4, serif' }}>
                      Facebook Template System
                    </h3>
                    {facebookTemplatesOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {facebookTemplatesOpen && (
                    <div className="p-6 pt-4 space-y-6">
                      {/* Design Spec */}
                      <div className="bg-white border border-[#e8eadf] p-4 rounded">
                        <h4 className="font-semibold mb-3 text-[#5e6738]">Template Design Spec</h4>
                        <ul className="space-y-2 text-sm">
                          <li><strong>Layout:</strong> Split-screen — left half authentic classroom photo, right half solid Primrose Green panel</li>
                          <li><strong>Typography:</strong> White elegant serif headlines (Sagona/Source Serif Pro) + smaller sans-serif body (Poppins)</li>
                          <li><strong>Logo:</strong> Circular white Primrose Schools rooster logo, bottom-right of green panel — every template</li>
                          <li><strong>Photography:</strong> Real classrooms, real children, real staff — no stock. Child-level shots, warm authentic moments</li>
                          <li><strong>Format:</strong> Landscape ~1200x628 (Facebook feed optimized)</li>
                          <li><strong>Color:</strong> Primrose Green (#5e6738) — exact match required</li>
                        </ul>
                      </div>

                      {/* Strategic Angles */}
                      <div className="bg-white border border-[#e8eadf] p-4 rounded">
                        <h4 className="font-semibold mb-3 text-[#5e6738]">6 Strategic Angles (Message Ladder)</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left py-2 px-2 font-semibold">Angle</th>
                                <th className="text-left py-2 px-2 font-semibold">Hook</th>
                                <th className="text-left py-2 px-2 font-semibold">Example Copy</th>
                                <th className="text-left py-2 px-2 font-semibold">When to Use</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              <tr>
                                <td className="py-2 px-2 font-semibold">Academic Proof</td>
                                <td className="py-2 px-2">Hard statistics, measurable outcomes</td>
                                <td className="py-2 px-2 text-xs">"100% of pre-k students test at or above grade level"</td>
                                <td className="py-2 px-2 text-xs">Cold audiences, high-education demographics</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-2 font-semibold">Community/Hyper-Local</td>
                                <td className="py-2 px-2">Local identity, belonging</td>
                                <td className="py-2 px-2 text-xs">"Lexington Parents Wanted a School — That's what we built."</td>
                                <td className="py-2 px-2 text-xs">Re-targeting, community building, warm audiences</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-2 font-semibold">Premium Infant</td>
                                <td className="py-2 px-2">Luxury positioning, aspirational language</td>
                                <td className="py-2 px-2 text-xs">"Your Infant's Elevated Beginning — Where excellence begins."</td>
                                <td className="py-2 px-2 text-xs">Parents of infants 0-12 months, highest-income demos</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-2 font-semibold">Urgency/Scarcity</td>
                                <td className="py-2 px-2">FOMO + social proof</td>
                                <td className="py-2 px-2 text-xs">"Secure your child's place... Limited spots remain"</td>
                                <td className="py-2 px-2 text-xs">Bottom-funnel, re-targeting, enrollment season push</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-2 font-semibold">Diversity/Inclusion</td>
                                <td className="py-2 px-2">Cultural representation + superlative claim</td>
                                <td className="py-2 px-2 text-xs">"Diverse Minds, Bright Futures — diverse perspectives enrich..."</td>
                                <td className="py-2 px-2 text-xs">Indian-American and Asian-American segments, Lexington/Winchester/Chelmsford</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-2 font-semibold">Seasonal/Convenience</td>
                                <td className="py-2 px-2">Pain point relief</td>
                                <td className="py-2 px-2 text-xs">"Skip the Battle for Summer Camp Sign Up"</td>
                                <td className="py-2 px-2 text-xs">Late winter/early spring (Jan–March)</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Template Inventory */}
                      <div className="bg-white border border-[#e8eadf] p-4 rounded">
                        <h4 className="font-semibold mb-3 text-[#5e6738]">Template Inventory (18 Total)</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-200 bg-gray-50">
                                <th className="text-left py-2 px-2 font-semibold">File</th>
                                <th className="text-left py-2 px-2 font-semibold">Location</th>
                                <th className="text-left py-2 px-2 font-semibold">Angle</th>
                                <th className="text-left py-2 px-2 font-semibold">Key Copy</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              <tr><td className="py-1 px-2">1.png</td><td className="py-1 px-2">General</td><td className="py-1 px-2">Academic outcomes</td><td className="py-1 px-2">"100% of pre-k students test at or above grade level"</td></tr>
                              <tr><td className="py-1 px-2">Lexington General.png</td><td className="py-1 px-2">Lexington</td><td className="py-1 px-2">Community/belonging</td><td className="py-1 px-2">"Lexington Parents Wanted a School"</td></tr>
                              <tr><td className="py-1 px-2">Lexington General (2).png</td><td className="py-1 px-2">Lexington</td><td className="py-1 px-2">Academic variant</td><td className="py-1 px-2">100% stat variation</td></tr>
                              <tr><td className="py-1 px-2">Lexington Infant.png</td><td className="py-1 px-2">Lexington</td><td className="py-1 px-2">Infant premium</td><td className="py-1 px-2">Infant-focused</td></tr>
                              <tr><td className="py-1 px-2">Winchester general.png</td><td className="py-1 px-2">Winchester</td><td className="py-1 px-2">Structure/routine</td><td className="py-1 px-2">"Winchester's Structured Start"</td></tr>
                              <tr><td className="py-1 px-2">Winchester Infant.png</td><td className="py-1 px-2">Winchester</td><td className="py-1 px-2">Infant premium</td><td className="py-1 px-2">"Your Infant's Elevated Beginning"</td></tr>
                              <tr><td className="py-1 px-2">Winchester Infant (2).png</td><td className="py-1 px-2">Winchester</td><td className="py-1 px-2">Infant variant</td><td className="py-1 px-2">Infant variation</td></tr>
                              <tr><td className="py-1 px-2">Winchester and Lexington.png</td><td className="py-1 px-2">Winchester+Lex</td><td className="py-1 px-2">Combined geo</td><td className="py-1 px-2">Dual-market targeting</td></tr>
                              <tr><td className="py-1 px-2">Winchester Community.png</td><td className="py-1 px-2">Winchester</td><td className="py-1 px-2">Diversity/community</td><td className="py-1 px-2">"Diverse Minds, Bright Futures"</td></tr>
                              <tr><td className="py-1 px-2">Bedford general.png</td><td className="py-1 px-2">Bedford</td><td className="py-1 px-2">General awareness</td><td className="py-1 px-2">Bedford geo-targeted</td></tr>
                              <tr><td className="py-1 px-2">Burlington Summer.png</td><td className="py-1 px-2">Burlington</td><td className="py-1 px-2">Seasonal/convenience</td><td className="py-1 px-2">"Skip the Battle for Summer Camp"</td></tr>
                              <tr><td className="py-1 px-2">Woburn Scarcity.png</td><td className="py-1 px-2">Woburn</td><td className="py-1 px-2">Urgency/scarcity</td><td className="py-1 px-2">"Limited spots remain"</td></tr>
                              <tr><td className="py-1 px-2">Chelmsford.png</td><td className="py-1 px-2">Chelmsford</td><td className="py-1 px-2">Diversity/community</td><td className="py-1 px-2">"Diverse Minds" (Holi imagery)</td></tr>
                              <tr><td className="py-1 px-2">Westford Infants.png</td><td className="py-1 px-2">Westford</td><td className="py-1 px-2">Infant premium</td><td className="py-1 px-2">Westford infant-focused</td></tr>
                              <tr><td className="py-1 px-2">Westford Infants (2).png</td><td className="py-1 px-2">Westford</td><td className="py-1 px-2">Infant variant</td><td className="py-1 px-2">Variation</td></tr>
                              <tr><td className="py-1 px-2">Billerica.png</td><td className="py-1 px-2">Billerica</td><td className="py-1 px-2">General</td><td className="py-1 px-2">Billerica geo-targeted</td></tr>
                              <tr><td className="py-1 px-2">Billerica Infants.png</td><td className="py-1 px-2">Billerica</td><td className="py-1 px-2">Infant</td><td className="py-1 px-2">Billerica infant-focused</td></tr>
                              <tr><td className="py-1 px-2">STAR Results.png</td><td className="py-1 px-2">General</td><td className="py-1 px-2">Social proof/outcomes</td><td className="py-1 px-2">100% stat + QR code (print/flyer)</td></tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* GYC Rules for Zac */}
                      <div className="bg-amber-50 border-l-4 border-amber-500 p-4">
                        <h4 className="font-semibold mb-3 text-amber-900">🎨 GYC Rules for Zac/Production (8 Rules)</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <span>✅ Always split-screen — left photo, right green panel. Do not deviate.</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <span>✅ Only authentic classroom photos — never stock</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <span>✅ Primrose Green (#5e6738) on the right panel — not a guess, not a close color</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <span>✅ White circular Primrose logo bottom-right on every ad</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <span>✅ Serif headline, sans-serif body — per brand guide</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <span>✅ No ALL CAPS in any headline</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <span>✅ Always name the town in copy — hyper-local is the strategy</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <input type="checkbox" className="mt-1" />
                            <span>✅ Match the angle to the audience — don't use scarcity on cold audiences; don't use academic outcomes on infant parents</span>
                          </div>
                        </div>
                      </div>

                      {/* Missing Templates */}
                      <div className="bg-red-50 border-l-4 border-red-500 p-4">
                        <h4 className="font-semibold mb-2 text-red-900">⚠️ Missing Templates (Opportunity)</h4>
                        <ul className="space-y-1 text-sm text-red-800">
                          <li>• <strong>Woburn:</strong> Only has Scarcity — needs General + Infant variations</li>
                          <li>• <strong>Chelmsford:</strong> Only has Diversity — needs General + Infant variations</li>
                          <li>• <strong>Bedford:</strong> Has General — needs Infant</li>
                          <li>• <strong>Westford:</strong> Has Infants — needs General</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* Instagram Template System */}
                <div className="border border-[#e8eadf] rounded-lg overflow-hidden mt-6">
                  <button
                    onClick={() => setInstagramTemplatesOpen(!instagramTemplatesOpen)}
                    className="w-full flex items-center justify-between p-4 bg-[#f8f9f5] hover:bg-gray-50 transition-colors"
                  >
                    <h3 className="text-lg font-bold text-[#5e6738]" style={{ fontFamily: 'Source Serif 4, serif' }}>
                      Instagram Template System
                    </h3>
                    {instagramTemplatesOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  {instagramTemplatesOpen && (
                    <div className="p-6 pt-4 space-y-6">
                      {/* Philosophy */}
                      <div className="bg-white border border-[#e8eadf] p-4 rounded">
                        <h4 className="font-semibold mb-3 text-[#5e6738]">Fundamentally Different Philosophy</h4>
                        <p className="text-sm mb-3">
                          Instagram is <strong>editorial and emotional</strong>; Facebook is informational and direct-response.
                        </p>
                        <ul className="space-y-2 text-sm">
                          <li><strong>Orientation:</strong> 4:5 portrait (1080x1350) — maximum vertical real estate</li>
                          <li><strong>Layout:</strong> Full-bleed photograph, white serif headline overlaid (bottom-left or right)</li>
                          <li><strong>Copy:</strong> Headline carries the entire message — no body copy</li>
                          <li><strong>Privacy:</strong> White heart icon overlaid on children's faces where required</li>
                          <li><strong>No colored panels</strong> — Instagram native aesthetic</li>
                        </ul>
                      </div>

                      {/* Template Descriptions */}
                      <div className="bg-white border border-[#e8eadf] p-4 rounded">
                        <h4 className="font-semibold mb-3 text-[#5e6738]">6 Templates</h4>
                        <div className="space-y-3 text-sm">
                          <div className="border-l-4 border-[#5e6738] pl-3">
                            <div className="font-semibold">1. "Before Davis, There is Primrose."</div>
                            <div className="text-xs text-gray-600 mt-1">
                              Legacy/Pipeline angle. Two children in graduation caps, shot from behind. 
                              "Davis" = Davis Academy (local feeder/private school). Positions Primrose as the prerequisite to prestigious K-12.
                              <strong className="block mt-1">This is Hill Holliday-level work.</strong>
                            </div>
                          </div>
                          <div className="border-l-4 border-gray-300 pl-3">
                            <div className="font-semibold">2. UGC Template (no headline)</div>
                            <div className="text-xs text-gray-600 mt-1">
                              Infant with "Make a Difference" board book (Wangari Maathai — culturally intentional). Looks like staff-shot organic content.
                            </div>
                          </div>
                          <div className="border-l-4 border-gray-300 pl-3">
                            <div className="font-semibold">3. UGC Template (no headline)</div>
                            <div className="text-xs text-gray-600 mt-1">
                              Boy reading dinosaur book on floor. Authentic classroom moment, independent engagement.
                            </div>
                          </div>
                          <div className="border-l-4 border-[#ff9e1b] pl-3">
                            <div className="font-semibold">4. "The Right Foundation for the Future"</div>
                            <div className="text-xs text-gray-600 mt-1">
                              Aspirational/awareness angle. Toddler with turquoise scarf, white heart privacy overlay.
                            </div>
                          </div>
                          <div className="border-l-4 border-[#ff9e1b] pl-3">
                            <div className="font-semibold">5. "Your Infant's Elevated Beginning"</div>
                            <div className="text-xs text-gray-600 mt-1">
                              Infant premium angle. <strong>Same image as template 4, swapped headline</strong> — intentional A/B copy test.
                            </div>
                          </div>
                          <div className="border-l-4 border-[#5e6738] pl-3">
                            <div className="font-semibold">6. "100% of students test at or above grade level"</div>
                            <div className="text-xs text-gray-600 mt-1">
                              Academic proof angle. Girl with sensory bin, colorful rug. Stat alone converts — stripped of all supporting copy.
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Facebook vs Instagram Table */}
                      <div className="bg-white border border-[#e8eadf] p-4 rounded">
                        <h4 className="font-semibold mb-3 text-[#5e6738]">Key Differences: Facebook vs Instagram</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left py-2 px-2 font-semibold">Element</th>
                                <th className="text-left py-2 px-2 font-semibold">Facebook</th>
                                <th className="text-left py-2 px-2 font-semibold">Instagram</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              <tr><td className="py-2 px-2">Layout</td><td className="py-2 px-2">Split-screen (photo + green panel)</td><td className="py-2 px-2">Full-bleed photo only</td></tr>
                              <tr><td className="py-2 px-2">Copy density</td><td className="py-2 px-2">Headline + body copy</td><td className="py-2 px-2">Headline only (or none)</td></tr>
                              <tr><td className="py-2 px-2">CTA</td><td className="py-2 px-2">Often baked-in</td><td className="py-2 px-2">Platform button only</td></tr>
                              <tr><td className="py-2 px-2">Tone</td><td className="py-2 px-2">Informational + aspirational</td><td className="py-2 px-2">Emotional + editorial</td></tr>
                              <tr><td className="py-2 px-2">Geo-targeting</td><td className="py-2 px-2">Town name in copy</td><td className="py-2 px-2">Broad aspirational — audience handles geo</td></tr>
                              <tr><td className="py-2 px-2">Brand chrome</td><td className="py-2 px-2">Green panel + logo always present</td><td className="py-2 px-2">Minimal (logo sometimes absent)</td></tr>
                              <tr><td className="py-2 px-2">Testing method</td><td className="py-2 px-2">Different geo/message ads</td><td className="py-2 px-2">A/B copy test on same image</td></tr>
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-3 text-sm text-gray-700">
                          <strong>Strategic Job Split:</strong><br />
                          Facebook = Reach the right parents with the right local message (geotargeting, information, proof)<br />
                          Instagram = Create desire and emotional connection before the rational decision (aspirational, editorial, identity-based)
                        </div>
                      </div>

                      {/* The Davis Ad Callout */}
                      <div className="bg-[#5e6738] text-white p-5 rounded">
                        <h4 className="font-semibold mb-2 text-white">🏆 "Before Davis, There is Primrose" — Why This Is Hill Holliday Level Work</h4>
                        <ul className="space-y-2 text-sm">
                          <li>• Boldest, most sophisticated ad in either set (Facebook or Instagram)</li>
                          <li>• "Davis" = Davis Academy or similar local feeder/private school known to MA parents</li>
                          <li>• Positions Primrose as the prerequisite to the prestigious K-12 pipeline</li>
                          <li>• Targets parents already thinking 5, 10, 15 years ahead (long-term decision makers)</li>
                          <li>• Two children in graduation regalia, shot from behind — aspirational, journey-forward imagery</li>
                          <li>• Completely clean — no logo visible. The brand confidence is striking.</li>
                          <li>• <strong>Hill Holliday fingerprint:</strong> Only someone who knows the local market deeply would know "Davis" is the name that makes Boston-area parents pay attention</li>
                        </ul>
                      </div>

                      {/* A/B Copy Test */}
                      <div className="bg-white border border-[#e8eadf] p-4 rounded">
                        <h4 className="font-semibold mb-3 text-[#5e6738]">The A/B Copy Test Structure (Templates 4 + 5)</h4>
                        <p className="text-sm mb-2">
                          Templates 4 and 5 use <strong>identical photography, different headlines</strong>. This is intentional media testing:
                        </p>
                        <ul className="space-y-1 text-sm">
                          <li>• Hold visual constant, isolate copy performance</li>
                          <li>• Broad aspirational ("Foundation for the Future") vs. age-segment specific ("Your Infant's Elevated Beginning")</li>
                          <li>• Tests whether general awareness or targeted premium positioning converts better</li>
                        </ul>
                      </div>

                      {/* UGC Templates */}
                      <div className="bg-white border border-[#e8eadf] p-4 rounded">
                        <h4 className="font-semibold mb-3 text-[#5e6738]">UGC Templates (2 + 3) — How and Why They Work</h4>
                        <p className="text-sm mb-2">
                          No headline, no logo — designed to look like staff-shot Instagram content.
                        </p>
                        <ul className="space-y-1 text-sm">
                          <li>• Blend into organic feed (reduces "ad blindness")</li>
                          <li>• Template 2 has culturally intentional touch: board book is about Wangari Maathai (Kenyan environmental activist) — signals curriculum depth and diversity values</li>
                          <li>• Template 3: boy deep in dinosaur book — showcases independent engagement with learning</li>
                          <li>• White heart privacy overlay is Instagram-native (mimics Instagram's own tools)</li>
                        </ul>
                      </div>

                      {/* GYC Implications */}
                      <div className="bg-amber-50 border-l-4 border-amber-500 p-4">
                        <h4 className="font-semibold mb-3 text-amber-900">🎨 GYC Implications for Zac</h4>
                        <ul className="space-y-2 text-sm">
                          <li>• <strong>Instagram ≠ Facebook with a different crop.</strong> These are different creative philosophies.</li>
                          <li>• Full-bleed photography only — no green panel, no copy blocks</li>
                          <li>• Headline is the ad. Make it earn its place. If it's not arresting, cut it.</li>
                          <li>• White serif on photo — must be legible against the image (choose photo backgrounds carefully)</li>
                          <li>• "Before Davis, There is Primrose" is the template for market-specific copy — know the local feeder schools. What's the "Davis" for Woburn? Chelmsford?</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Location Cards */}
          <div id="locations" className="border border-[#e8eadf] rounded-lg overflow-hidden">
            <button
              onClick={() => setLocationsOpen(!locationsOpen)}
              className="w-full flex items-center justify-between p-6 bg-white hover:bg-gray-50 transition-colors"
              style={{ border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <h2 className="text-2xl font-bold text-[#5e6738]" style={{ fontFamily: 'Source Serif 4, serif', margin: 0 }}>
                Locations
              </h2>
              <span style={{ color: '#9ca3af', fontSize: 18, flexShrink: 0 }}>{locationsOpen ? '▲' : '▼'}</span>
            </button>
            {locationsOpen && <div className="p-6 pt-0">
            <div className="grid md:grid-cols-3 gap-6">
              {locations.map((loc) => {
                const pct = Math.round((loc.enrolled / loc.capacity) * 100);
                const gap = loc.target - loc.enrolled;
                return (
                  <div key={loc.id} className="bg-white border border-[#e8eadf] rounded-lg p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-[#5e6738]">{loc.name}</h3>
                        <a href={loc.gbpMapUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm mt-1 hover:opacity-80" style={{textDecoration:'none'}}>
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-semibold" style={{color:'#1f2937'}}>{loc.gbpRating}</span>
                          <span style={{color:'#4b5563'}}>({loc.gbpReviews} reviews)</span>
                          <span style={{color:'#6b7280',fontSize:11}}>↗ GBP</span>
                        </a>
                      </div>
                      <span className={`px-3 py-1 rounded text-xs font-semibold text-white ${getEnrollmentColor(pct)}`}>
                        {pct}%
                      </span>
                    </div>

                    {/* Quick Links Row */}
                    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>
                      <a href={loc.aclUrl} style={{fontSize:12,fontWeight:600,color:'#fff',background:'#5e6738',padding:'4px 10px',borderRadius:6,textDecoration:'none'}}>📋 ACL Card</a>
                      <a href={loc.gbpMapUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:12,fontWeight:600,color:'#374151',background:'#f3f4f6',padding:'4px 10px',borderRadius:6,textDecoration:'none',border:'1px solid #e5e7eb'}}>🗺 Google Maps</a>
                      <a href={loc.website} target="_blank" rel="noopener noreferrer" style={{fontSize:12,fontWeight:600,color:'#374151',background:'#f3f4f6',padding:'4px 10px',borderRadius:6,textDecoration:'none',border:'1px solid #e5e7eb'}}>🌐 Website</a>
                      {loc.notionUrl && <a href={loc.notionUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:12,fontWeight:600,color:'#374151',background:'#f3f4f6',padding:'4px 10px',borderRadius:6,textDecoration:'none',border:'1px solid #e5e7eb'}}>📝 Notion</a>}
                    </div>

                    {/* Enrollment Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Enrollment: {loc.enrolled}/{loc.capacity}</span>
                        <span>Target: {loc.target} (90%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full ${getEnrollmentBarColor(pct)} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Gap: <span className="font-semibold text-red-600">-{gap} students</span>
                      </div>
                    </div>

                    {/* Data Grid */}
                    <div className="space-y-2 text-sm mb-4 pb-4 border-b border-gray-200">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{loc.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{loc.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">Capacity: {loc.capacity}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">Tuition Tier: {loc.tuitionTier === 'high' ? 'High' : 'Lower'}</span>
                      </div>
                    </div>

                    {/* Target Markets */}
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm mb-2 text-[#5e6738]">Target Markets</h4>
                      <div className="space-y-2">
                        {loc.targetMarkets.map((market, i) => (
                          <a key={i} href={market.censusUrl} target="_blank" rel="noopener noreferrer" style={{display:'block',textDecoration:'none',background:'#f8f9f5',padding:'8px 10px',borderRadius:6,border:'1px solid #e8eadf'}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                              <span style={{fontWeight:600,fontSize:13,color:'#1f2937'}}>{market.name}</span>
                              <span style={{fontSize:10,color:'#6b7280'}}>Census ↗</span>
                            </div>
                            <div style={{fontSize:12,color:'#374151',marginTop:2}}>
                              <span style={{fontWeight:600,color:'#166534'}}>${(market.income / 1000).toFixed(0)}K</span> income &bull; <span style={{fontWeight:600,color:'#1d4ed8'}}>{market.asian}%</span> Asian &bull; <span style={{fontWeight:600}}>{market.degree}%</span> college degree
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>

                    {/* Messaging Angle */}
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm mb-2 text-[#5e6738]">Messaging Angle</h4>
                      <p className="text-xs text-gray-700 leading-relaxed">{loc.messagingAngle}</p>
                    </div>

                    {/* Primary Challenge */}
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm mb-2 text-red-700">Primary Challenge</h4>
                      <p className="text-xs text-gray-700 leading-relaxed">{loc.primaryChallenge}</p>
                    </div>

                    {/* Services */}
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm mb-2 text-[#5e6738]">Services Active</h4>
                      <div className="flex flex-wrap gap-2">
                        {loc.services.map((service) => (
                          <span key={service} className="px-2 py-1 bg-[#5e6738] text-white text-xs rounded">
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Location Notes */}
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-3 text-xs">
                      <h4 className="font-semibold mb-1">Key Intel</h4>
                      <p className="text-gray-700 leading-relaxed">{loc.notes}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>}
          </div>

          {/* Client Operations Intelligence */}
          <div style={{background:'#fff',border:'1px solid #e8eadf',borderRadius:10,overflow:'hidden'}}>
            <button
              onClick={() => setClientOpsOpen(!clientOpsOpen)}
              style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'1.25rem 1.5rem',background:clientOpsOpen ? '#f0f3e8' : '#fff',border:'none',cursor:'pointer',textAlign:'left'}}
            >
              <h2 style={{fontFamily:'Source Serif 4, serif',fontWeight:700,fontSize:20,color:'#5e6738',margin:0}}>Client Operations &amp; Key Intelligence</h2>
              <span style={{color:'#9ca3af',fontSize:18,flexShrink:0}}>{clientOpsOpen ? '▲' : '▼'}</span>
            </button>
            {clientOpsOpen && <div style={{padding:'0 1.5rem 1.5rem'}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>

              {/* Rachel Profile */}
              <div style={{background:'#f8f9f5',border:'1px solid #e8eadf',borderRadius:8,padding:'1rem'}}>
                <div style={{fontWeight:700,fontSize:14,color:'#111827',marginBottom:8}}>Rachel Van Emon — The Owner</div>
                <div style={{fontSize:13,color:'#374151',lineHeight:1.65}}>
                  <p style={{margin:'0 0 8px'}}>Rachel is the <strong>economic buyer</strong> — Kate is the day-to-day contact. Critical distinction for relationship management. Both need to be won, but differently.</p>
                  <ul style={{margin:0,paddingLeft:16,lineHeight:1.8}}>
                    <li>Previously head of <strong>Primrose National Advisory Council</strong></li>
                    <li>Husband ran sales organizations for 30 years</li>
                    <li>Charges <strong>$3,488/mo for infant care</strong> — among highest in the Primrose system</li>
                    <li>Very hands-on: &ldquo;I&apos;ll stand out front with a QR code asking for reviews&rdquo;</li>
                    <li>Ready to fund $1K/referral immediately — just needs the structure</li>
                    <li>On June 23, meeting Bruce for the first time: &ldquo;hook, line, and sinker interested&rdquo;</li>
                  </ul>
                </div>
              </div>

              {/* Platform Access Status */}
              <div style={{background:'#f8f9f5',border:'1px solid #e8eadf',borderRadius:8,padding:'1rem'}}>
                <div style={{fontWeight:700,fontSize:14,color:'#111827',marginBottom:8}}>Platform Access Status</div>
                <div style={{display:'flex',flexDirection:'column',gap:6,fontSize:13}}>
                  {[
                    ['✅','Yext','Sebastian has access — pushes to all directories except Manta'],
                    ['🔄','Facebook/Instagram','Page-level access. Burlington done. Woburn/Chelmsford in progress.'],
                    ['❌','GBP Manager Access','Blocked by corporate. Kate making direct ask. Workaround: manual posting via Katie (corporate).'],
                    ['❌','Bing + Apple Maps','Corporate-controlled. Bruce wants Kate to claim Bing directly — critical for ChatGPT search.'],
                    ['❌','Google Ads Admin','Blocked. GYC positioning LSAs as workaround — "map ads" (pay-per-lead), different from Search/PMax.'],
                    ['❌','Website Backend','No access. Corporate controls all location websites.'],
                    ['✅','Facebook Pixel','Status UNKNOWN — Kate does not know if installed. Priority investigation.'],
                  ].map(([icon, name, detail]) => (
                    <div key={name} style={{display:'flex',alignItems:'flex-start',gap:8}}>
                      <span style={{fontSize:14,flexShrink:0,marginTop:1}}>{icon}</span>
                      <div>
                        <span style={{fontWeight:600,color:'#111827'}}>{name}: </span>
                        <span style={{color:'#374151'}}>{detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3,500 Lead List */}
              <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:'1rem'}}>
                <div style={{fontWeight:700,fontSize:14,color:'#92400e',marginBottom:8}}>⚡ 3,500+ Lead Email List — DORMANT</div>
                <div style={{fontSize:13,color:'#78350f',lineHeight:1.65}}>
                  <p style={{margin:'0 0 8px'}}>Kate has a <strong>3,500+ person lead database</strong> sitting largely unused. Currently sends 1x/week minimum via ProCare — mix of educational content and event invitations. No structured enrollment-focused sequences.</p>
                  <p style={{margin:'0 0 8px'}}><strong>GYC&apos;s job:</strong> Build email campaign templates that activate this list. Estimated 3-12 enrollments/month from a properly activated sequence.</p>
                  <p style={{margin:0}}>Recently started segmenting by tour status — positive signal that Kate is thinking more strategically about the funnel.</p>
                </div>
              </div>

              {/* Campus Visit Philosophy */}
              <div style={{background:'#f8f9f5',border:'1px solid #e8eadf',borderRadius:8,padding:'1rem'}}>
                <div style={{fontWeight:700,fontSize:14,color:'#111827',marginBottom:8}}>Campus Visit vs. Logistical Tour</div>
                <div style={{fontSize:13,color:'#374151',lineHeight:1.65}}>
                  <p style={{margin:'0 0 8px'}}>Rachel runs <strong>&ldquo;campus visits&rdquo;</strong> — relationship-based, full experience. Bruce flagged the distinction on the June 23 call:</p>
                  <div style={{background:'#fff',border:'1px solid #e8eadf',borderRadius:6,padding:'8px 10px',margin:'0 0 8px'}}>
                    <div style={{fontSize:12,fontWeight:600,color:'#5e6738',marginBottom:4}}>CLOSE RATES</div>
                    <div style={{display:'flex',gap:12}}>
                      <div><div style={{fontWeight:700,fontSize:18,color:'#e03c31'}}>30–40%</div><div style={{fontSize:11,color:'#374151'}}>Logistical tours</div></div>
                      <div style={{display:'flex',alignItems:'center',color:'#9ca3af'}}>→</div>
                      <div><div style={{fontWeight:700,fontSize:18,color:'#166534'}}>90%</div><div style={{fontSize:11,color:'#374151'}}>Relationship-based campus visits</div></div>
                    </div>
                  </div>
                  <p style={{margin:0}}>Opportunity: GYC tour training can lift close rates from the 30-40% range to 90%. Blueprint includes tour sales training workshops.</p>
                </div>
              </div>

              {/* CRM & Photo Workflow */}
              <div style={{background:'#f8f9f5',border:'1px solid #e8eadf',borderRadius:8,padding:'1rem'}}>
                <div style={{fontWeight:700,fontSize:14,color:'#111827',marginBottom:8}}>CRM &amp; Content Workflow</div>
                <div style={{fontSize:13,color:'#374151',lineHeight:1.65}}>
                  <ul style={{margin:0,paddingLeft:16,lineHeight:1.9}}>
                    <li><strong>CRM:</strong> ProCare — used for both existing families and leads. Basic but staying.</li>
                    <li><strong>Email:</strong> 1x/week minimum to leads via ProCare. Educational content + event CTAs. Needs persistent enrollment CTA added.</li>
                    <li><strong>Photography:</strong> All from real classrooms — no stock photos. Stored in Apple Photos.</li>
                    <li><strong>M3 will:</strong> Auto-tag photos, create searchable database, pull for automated posts.</li>
                    <li><strong>Competitor alert:</strong> Goddard School recently opened nearby — first time Primrose has had direct premium competition in market.</li>
                  </ul>
                </div>
              </div>

            </div>
            </div>}
          </div>

          {/* Call History */}
          <div id="calls">
            <div className="flex items-center justify-between mb-6 px-2">
              <h2 className="text-2xl font-bold text-[#5e6738]" style={{ fontFamily: 'Source Serif 4, serif' }}>
                Call History
              </h2>
              <a 
                href="/primrose/journey"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#5e6738] text-white rounded-lg hover:bg-[#4a5229] transition-colors text-sm font-medium"
              >
                View Full Journey →
              </a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {calls.map((call, i) => {
                const isOpen = expandedCall === i;
                const openItems = call.actionItems.filter((a: any) => !a.done).length;
                return (
                  <div key={i} style={{ background: '#fff', border: `1px solid ${isOpen ? '#5e6738' : '#e8eadf'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.15s' }}>

                    {/* Clickable Header */}
                    <button
                      onClick={() => setExpandedCall(isOpen ? null : i)}
                      style={{ width: '100%', background: isOpen ? '#f0f3e8' : '#f8f9f5', border: 'none', cursor: 'pointer', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left' }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'Source Serif 4, serif', fontWeight: 700, fontSize: 17, color: '#5e6738' }}>{call.type}</span>
                          <span style={{ background: '#5e6738', color: '#fff', padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>{call.date}</span>
                          {call.duration && <span style={{ fontSize: 12, color: '#374151' }}>⏱ {call.duration}</span>}
                          {openItems > 0 && <span style={{ fontSize: 11, color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', padding: '1px 8px', borderRadius: 9999 }}>{openItems} open actions</span>}
                        </div>
                        {!isOpen && <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.5 }}>{call.summary.slice(0, 120)}…</p>}
                        {isOpen && <div style={{ fontSize: 12, color: '#374151' }}><strong>Attendees:</strong> {call.attendees}</div>}
                      </div>
                      <div style={{ flexShrink: 0, color: '#9ca3af', fontSize: 18 }}>{isOpen ? '▲' : '▼'}</div>
                    </button>

                    {/* Expanded Body */}
                    {isOpen && (
                      <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #e8eadf', display: 'flex', flexDirection: 'column', gap: 20 }}>

                        {/* Summary */}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 12, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Summary</div>
                          <p style={{ fontSize: 14, color: '#1f2937', margin: 0, lineHeight: 1.7 }}>{call.summary}</p>
                        </div>

                        {/* Topics Covered */}
                        {call.topics && call.topics.length > 0 && (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 12, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Topics Covered ({call.topics.length})</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {call.topics.map((topic: any, j: number) => (
                                <div key={j} style={{ borderLeft: '3px solid #5e6738', paddingLeft: 12 }}>
                                  <div style={{ fontWeight: 600, fontSize: 13, color: '#1f2937', marginBottom: 3 }}>{topic.heading}</div>
                                  <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.65 }}>{topic.detail}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Key Quotes */}
                        {call.quotes && call.quotes.length > 0 && (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 12, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Key Quotes</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {call.quotes.map((q: string, j: number) => (
                                <div key={j} style={{ borderLeft: '3px solid #93c5fd', background: '#eff6ff', padding: '8px 12px', borderRadius: '0 6px 6px 0' }}>
                                  <p style={{ fontSize: 13, color: '#1e40af', fontStyle: 'italic', margin: 0 }}>{q}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Items */}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 12, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Action Items</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {call.actionItems.map((item: any, j: number) => (
                              <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <span style={{ fontSize: 15, marginTop: 1, flexShrink: 0 }}>{item.done ? '✅' : '⬜'}</span>
                                <span style={{ fontSize: 13, color: item.done ? '#6b7280' : '#111827', textDecoration: item.done ? 'line-through' : 'none', lineHeight: 1.5 }}>{item.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
