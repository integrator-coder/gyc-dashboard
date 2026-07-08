'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Phone, Star, Users, Target, TrendingUp, Calendar, CheckCircle2, Circle } from 'lucide-react';

// Import Google Fonts
const fontImport = `
@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,200;0,400;0,600;0,700&family=Poppins:wght@300;400;500;600&display=swap');
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
      <div className="min-h-screen bg-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
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
            <h2 className="text-2xl font-bold text-[#5e6738] mb-6 px-2" style={{ fontFamily: 'Source Serif 4, serif' }}>
              Call History
            </h2>
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
