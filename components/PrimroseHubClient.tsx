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
    gbpRating: 4.8,
    gbpReviews: 37,
    enrolled: 99,
    capacity: 177,
    target: 160,
    tuitionTier: 'high',
    targetMarkets: [
      { name: 'Burlington', income: 146436, asian: 14.5, degree: 58.2 },
      { name: 'Lexington', income: 219402, asian: 33.0, degree: 85.0 },
      { name: 'Bedford', income: 172400, asian: 18.0, degree: 69.0 }
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
    gbpRating: 5.0,
    gbpReviews: 19,
    enrolled: 131,
    capacity: 177,
    target: 160,
    tuitionTier: 'high',
    targetMarkets: [
      { name: 'Woburn', income: 111185, asian: 8.5, degree: 45.4 },
      { name: 'Winchester', income: 218176, asian: 15.7, degree: 78.4 }
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
    gbpRating: 4.5,
    gbpReviews: 37,
    enrolled: 136,
    capacity: 177,
    target: 160,
    tuitionTier: 'lower',
    targetMarkets: [
      { name: 'Chelmsford', income: 140519, asian: 9.1, degree: 54.6 },
      { name: 'Westford', income: 187198, asian: 21.7, degree: 72.0 }
    ],
    messagingAngle: 'Value + quality balance. Price-conscious messaging for Chelmsford base. Premium academic framing for Westford expansion.',
    primaryChallenge: 'Maintaining momentum under new ownership (acquired 2.5yr ago). Different community culture. Price-sensitive market.',
    notes: 'Purchased by Kate ~2.5yr ago from another Primrose franchisee. Different culture/community — required adjustment. Chelmsford families (blue-collar) fill the school; Westford (wealthier) is expansion target. Lower tuition tier than Burlington/Woburn.',
    services: ['SEO', 'Command', 'Blueprint', 'PaidMedia']
  }
];

const calls = [
  {
    date: '2026-07-07',
    type: 'Blueprint Onboarding',
    attendees: 'Zu, Sebastian, Kate, Rachel',
    outcomes: 'Enrollment intel captured (99/131/136). Meta access setup started. Geographic targeting mapped. Referral program flagged. Pixel status unknown.',
    actionItems: [
      { text: 'Complete Woburn/Chelmsford FB access', done: false },
      { text: 'Investigate FB Pixel', done: false },
      { text: 'Share Bruce\'s referral program presentation', done: false },
      { text: 'Walk Kate through M3 workspace features module', done: false },
      { text: 'Kate to provide "what parents value" list per location', done: false }
    ]
  },
  {
    date: '2026-06-30',
    type: 'Sales/Upgrade',
    attendees: 'Bruce, Sebastian, Kate, Rachel',
    outcomes: 'Core package upgrade confirmed ($2,398/mo, July 1 start). Primrose corporate pilot opportunity identified. Bruce to contact Greg.',
    actionItems: [
      { text: 'Bruce contact Greg TODAY', done: false },
      { text: 'Core package agreement sent', done: true },
      { text: 'Check Yext capabilities', done: true }
    ]
  }
];

export default function PrimroseHubClient() {
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [brandGuideOpen, setBrandGuideOpen] = useState(true);
  const [creativeStandardsOpen, setCreativeStandardsOpen] = useState(false);
  const [facebookTemplatesOpen, setFacebookTemplatesOpen] = useState(false);
  const [instagramTemplatesOpen, setInstagramTemplatesOpen] = useState(false);

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
            <p className="text-lg mb-6">Brand Intelligence Hub</p>
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

        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* The Opportunity */}
          <div className="border border-[#e8eadf] rounded-lg overflow-hidden">
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
              <div className="p-6 pt-0 space-y-4">
                <div className="bg-[#f8f9f5] border-l-4 border-[#5e6738] p-4">
                  <h3 className="font-semibold text-lg mb-2">Primrose Corporate Partnership</h3>
                  <ul className="space-y-2 text-sm">
                    <li><strong>590+ schools nationwide</strong> — Primrose School Franchising Company</li>
                    <li><strong>Kate Latham&apos;s 3 locations</strong> = the corporate pilot for GYC&apos;s SEO/AIO services</li>
                    <li><strong>Greg (Primrose corporate contact)</strong> — Bruce&apos;s target outreach</li>
                    <li><strong>Stakes:</strong> Approved partner status = massive long-term revenue opportunity</li>
                    <li><strong>Kate&apos;s advice:</strong> &quot;Lead with value, not the ask&quot; — show heat maps + results</li>
                  </ul>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white border border-[#e8eadf] p-4 rounded">
                    <h4 className="font-semibold mb-2">Why This Matters</h4>
                    <ul className="text-sm space-y-1 text-gray-700">
                      <li>• Corporate already piloting with Digital Spice (50 schools)</li>
                      <li>• Greg is a data/heat map nerd (Bruce speaks his language)</li>
                      <li>• Kate willing to be the proof-of-concept</li>
                      <li>• M3 platform daily posting = key differentiator</li>
                    </ul>
                  </div>
                  <div className="bg-white border border-[#e8eadf] p-4 rounded">
                    <h4 className="font-semibold mb-2">Next Steps</h4>
                    <ul className="text-sm space-y-1 text-gray-700">
                      <li>• Bruce to contact Greg (flagged June 30 as urgent)</li>
                      <li>• Show Kate&apos;s heat map progress (March → June)</li>
                      <li>• Position M3 automated posting as primary value-add</li>
                      <li>• Lead with results, not with GBP access request</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Brand Guide */}
          <div className="border border-[#e8eadf] rounded-lg overflow-hidden">
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
          <div className="border border-[#e8eadf] rounded-lg overflow-hidden">
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
          <div>
            <h2 className="text-2xl font-bold text-[#5e6738] mb-6 px-2" style={{ fontFamily: 'Source Serif 4, serif' }}>
              Locations
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {locations.map((loc) => {
                const pct = Math.round((loc.enrolled / loc.capacity) * 100);
                const gap = loc.target - loc.enrolled;
                return (
                  <div key={loc.id} className="bg-white border border-[#e8eadf] rounded-lg p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-[#5e6738]">{loc.name}</h3>
                        <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-semibold">{loc.gbpRating}</span>
                          <span className="text-gray-400">({loc.gbpReviews} reviews)</span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded text-xs font-semibold text-white ${getEnrollmentColor(pct)}`}>
                        {pct}%
                      </span>
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
                          <div key={i} className="text-xs bg-[#f8f9f5] p-2 rounded">
                            <div className="font-semibold">{market.name}</div>
                            <div className="text-gray-600">
                              ${(market.income / 1000).toFixed(0)}K income • {market.asian}% Asian • {market.degree}% degree
                            </div>
                          </div>
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
          </div>

          {/* Call History */}
          <div>
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
            <div className="space-y-4">
              {calls.map((call, i) => (
                <div key={i} className="bg-white border border-[#e8eadf] rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-[#5e6738]" />
                        <h3 className="text-lg font-bold text-[#5e6738]">{call.type}</h3>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">{call.date}</div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {call.attendees}
                    </div>
                  </div>
                  <div className="mb-4">
                    <h4 className="font-semibold text-sm mb-2">Key Outcomes</h4>
                    <p className="text-sm text-gray-700">{call.outcomes}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Action Items</h4>
                    <div className="space-y-1">
                      {call.actionItems.map((item, j) => (
                        <div key={j} className="flex items-center gap-2 text-sm">
                          {item.done ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          )}
                          <span className={item.done ? 'text-gray-500 line-through' : 'text-gray-700'}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
