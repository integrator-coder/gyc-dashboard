'use client';

import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Calendar, Clock, Users, TrendingUp, Award, Target, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

const PG = '#5e6738'; // Primrose Green
const PO = '#ff9e1b'; // Primrose Orange
const PP = '#814c9e'; // Primrose Purple

const PrimroseJourneyClient: React.FC = () => {
  const [expandedCall, setExpandedCall] = useState<number | null>(null);

  const timelineEvents = [
    {
      date: 'March 6, 2026',
      title: 'Kate Enters GYC System',
      type: 'SALES',
      summary: 'Kate Latham (Primrose Burlington, Woburn, Chelmsford) comes in via GYC Marketing Consultation. Jesse Poirier handles the initial outreach. Deal closes March 10 at $899/mo (6-month commitment, $5,394 total). Sebastian Estrada assigned as Growth Advisor.',
      needle: 'Kate came in through a consultation and committed to a 6-month package within 4 days. Jesse made the introduction. Sebastian built everything from there. The entire corporate meeting happened within 4 months of her first contact.',
    },
    {
      date: 'March–June 2026',
      title: 'Sebastian Builds the Relationship (4 Months)',
      type: 'ACCOUNT',
      summary: 'Kate pays $899/mo through April, May, and June. Sebastian works the accounts across Burlington, Woburn, and Chelmsford. Kate receives heat map results showing measurable SEO/AIO progress March → June. This 4-month track record is what Bruce brings to Greg at the corporate meeting.',
      needle: 'The corporate meeting did not happen because of a great pitch. It happened because Sebastian delivered enough real results in 4 months that Kate trusted GYC to stand in front of her franchise\'s C-suite. That is the real win.',
    },
    {
      date: 'June 23, 2026',
      title: 'Corporate C-Suite Meeting',
      type: 'CORPORATE',
      duration: '114 minutes',
      summary: 'Kate organized a meeting between GYC leadership (Bruce) and Primrose corporate executives — Greg Foglesong (CCO) and Andrea Freeman (VP Marketing). Essentially a pitch disguised as a client call.',
      quote: '"The stats you shared today far exceed what they saw from the two pilots they just finished." — Kate Latham',
      needle: 'GYC\'s data demolished Drive ($107/click). Bruce\'s Reputation Engine thesis resonated with Greg (ex-engineer). Rachel gave an unsolicited "hook, line, and sinker" endorsement to C-suite she\'d just met.',
    },
    {
      date: 'June 27, 2026',
      title: 'Greg Dinner — The Follow-Through',
      type: 'CORPORATE',
      summary: 'Kate and Rachel met Greg Foglesong (Primrose CCO) for dinner to discuss GYC access requests: GBP manager access, Google Ads admin, schema permissions. Sebastian\'s technical close from June 23 was the agenda.',
      needle: 'Whatever happened at this dinner cleared the path for the June 30 upgrade. Kate executed perfectly on the handoff from the corporate meeting.',
    },
    {
      date: 'June 29/30, 2026',
      title: 'Core Package Upgrade Confirmed',
      type: 'ACCOUNT',
      duration: '53 minutes',
      summary: 'Kate and Rachel upgrade from Local AI Visibility to full Core package for all 3 locations ($2,398/mo, 6-month commitment, July 1 start). Kate volunteered her locations as the corporate pilot unprompted.',
      quote: '"Let us be the pilot. Give them some management access, and then you can see what it does for us." — Kate Latham',
      needle: 'Market timing: Primrose co-op shut down July 1. Kate needed an approved alternative. GYC had earned the spot. Kate offered the pilot — GYC didn\'t have to ask.',
    },
    {
      date: 'July 1, 2026',
      title: 'Core Package Goes Live',
      type: 'ACCOUNT',
      summary: 'All 3 Primrose locations transition to Core. SEO/AIO, Meta ads, M3 platform, Blueprint training now active. Primrose co-op officially ended.',
      needle: 'The deadline forced the decision. Kate chose GYC through trust, data, and results — not price.',
    },
    {
      date: 'July 7, 2026',
      title: 'Blueprint Onboarding',
      type: 'ONBOARDING',
      duration: '50+ minutes',
      summary: 'Zu Vuong led first Blueprint onboarding. Sebastian set up Facebook/Instagram access during the call. Enrollment mapped: Burlington 56%, Woburn 74%, Chelmsford 77%. Geographic targeting and demographic strategy locked in.',
      needle: 'GYC showed immediate value: identified Burlington as #1 priority, surfaced the Asian/Indian demographic opportunity, started building location-specific ad strategies in the first session.',
    },
  ];

  const turningPoints = [
    { title: "Kate's Trust", body: "She organized the corporate C-suite meeting herself. That doesn't happen unless you've earned deep trust. Kate put her own reputation on the line to introduce GYC to Primrose corporate executives." },
    { title: "The Data Beat the Competition", body: "GYC's metrics 'far exceeded' both Drive and Eulerity pilots in front of the CCO. Drive: $107/click, 25M impressions → 489 clicks across 31 schools. That single number destroyed the competition's credibility." },
    { title: "Rachel's Endorsement", body: "The owner gave an unsolicited 'hook, line, and sinker interested' during the corporate pitch — to Bruce, who she was meeting for the first time. That kind of word-of-mouth happens because Sebastian built real trust at the account level." },
    { title: "Bruce's Thesis Landed", body: "Greg (CCO, ex-engineer from Home Depot/Spanx/Carter's/Bob's Furniture) asked probing questions. Bruce's data-driven Reputation Engine resonated because it was measurable, logical, and evidence-based." },
    { title: "Sebastian's Technical Close", body: "At the end of a 2-hour corporate meeting, Sebastian gave Greg exactly what he needed: 3 specific access asks (GBP manager, Google Ads admin, schema permissions) that Kate could bring to the Friday dinner with confidence." },
    { title: "The Friday Dinner Happened", body: "Kate and Rachel followed through on June 27 without being pushed. They took Sebastian's technical ask into a dinner with the CCO and came out the other side with a clear path to the upgrade call." },
    { title: "Market Timing", body: "Primrose's co-op was shutting down July 1. Kate needed an approved alternative now. GYC was already trusted, already proven. Being in the right place with the right results at the right moment isn't luck — it's what consistent delivery creates." },
    { title: "Kate Offered the Pilot", body: "Kate volunteered her 3 locations as the corporate pilot. GYC didn't have to ask, negotiate, or pitch it. She did it herself. That's what happens when your client becomes your advocate." },
  ];

  const callDetails = [
    {
      date: 'June 23, 2026',
      duration: '114 minutes',
      attendees: ['Sebastian Estrada (GYC Growth Advisor)', 'Bruce Spurr (GYC CEO)', 'Kate Latham (Client — Primrose)', 'Rachel Van Emon (Owner — 3 Primrose locations)', 'Andrea Freeman (VP Marketing, Primrose Corporate)', 'Greg Foglesong (Chief Commercial Officer, Primrose Corporate)'],
      summary: 'The pivotal meeting. Sebastian facilitated a session between GYC and Primrose C-suite that functioned as a corporate pitch without being framed as one. Bruce walked through GYC\'s Reputation Engine thesis (40+ min), market math, AI/SEO strategy, and paid ads approach. Kate shared competitive benchmarks from Drive agency that GYC used to destroy the competition. The meeting ended with Sebastian delivering a clean 3-item technical close that gave Greg exactly what he needed to move forward.',
      quotes: [
        '"The stats you shared today far exceed what they saw from the two pilots they just finished." — Kate Latham',
        '"I am hook, line, and sinker interested now in seeing what else we can do." — Rachel Van Emon',
        '"Every client we\'ve ever had that\'s gotten to 100+ reviews has been able to cut their media cost in half or more." — Bruce Spurr',
        '"$107 a click. That\'s insane! That\'s terrible. You might have gotten 5 leads at $10,000 per lead." — Bruce Spurr',
      ],
      right: [
        'Sebastian brought Bruce (CEO) onto the call — critical credibility for a C-suite audience',
        'Bruce demonstrated exceptional expertise: Reputation Engine, trust assets, AI-first thinking',
        'Used Kate\'s own competitive data ($107/click) to eliminate Drive and Eulerity in real time',
        'Sebastian delivered a precise 3-ask technical close at the end: GBP manager access, Google Ads admin, schema permissions',
        'Positioned GYC as franchisee-focused (not corporate-focused) — resonated with Rachel while leaving corporate door open',
      ],
      risks: [
        'Meeting ran nearly 2 hours with no formal agenda — could have been tighter',
        'No firm commitments from Greg or Andrea — interested but guarded',
        'Corporate may still reject access requests regardless of interest',
        'Andrea raised concern about GYC working with competing brands',
      ],
      next: 'Kate and Rachel scheduled a Friday dinner with Greg (June 27) using the 3 access asks Sebastian outlined as the agenda. Kate confirmed GYC\'s data "far exceeded" both pilot agencies.',
    },
    {
      date: 'June 29/30, 2026',
      duration: '53 minutes',
      attendees: ['Kate Latham (Client — Primrose)', 'Rachel Van Emon (Owner)', 'Bruce Spurr (GYC CEO)', 'Sebastian Estrada (GYC Growth Advisor)'],
      summary: 'The upgrade call. Kate and Rachel decided to move all 3 locations to the Core package ($2,398/mo, 6-month commitment, July 1 start). Kate volunteered her locations as the Primrose corporate pilot — unprompted. Bruce committed to contact Greg that day. The co-op deadline (July 1) created the urgency. GYC had already earned the trust. The call converted.',
      quotes: [
        '"Let us be the pilot. Give them some management access, and then you can see what it does for us." — Kate Latham',
        '"I wouldn\'t come at them with the ask. Just be an offer of help." — Kate\'s advice to Bruce on approaching Greg',
        '"I don\'t care if I can track it. I need to fill my schools." — Rachel Van Emon',
      ],
      right: [
        'Bruce led with value on Greg follow-up — heat maps, results, pilot offer — not with the ask',
        'Clear package breakdown: what\'s included, what\'s not, pricing, timeline',
        'Positioned Kate/Rachel as owners of the pilot opportunity — gave them agency',
        'Bruce committed to immediate action (contact Greg TODAY) — showed urgency and follow-through',
        'Identified GBP workaround: manual posting via Katie at corporate while access negotiation continues',
      ],
      risks: [
        'Kate\'s concern about Meta budget ($450/mo per location vs. current $450 total)',
        'Corporate could reject GBP access regardless of dinner outcome',
        'Burlington at 55% FTE — urgent and adds pressure to the relationship',
        'Primrose might flag Google Local Service Ads as a paid ads violation',
      ],
      next: 'Core package agreement sent to Kate/Rachel for all 3 locations (July 1 start). Bruce followed up with Greg immediately. July 1: package goes live across Burlington, Woburn, Chelmsford.',
    },
    {
      date: 'July 7, 2026',
      duration: '50+ minutes',
      attendees: ['Zu Vuong (GYC, Blueprint)', 'Sebastian Estrada (GYC, Web/SEO)', 'Kate Latham (Client — Primrose)', 'Rachel Van Emon (Owner)'],
      summary: 'First Blueprint onboarding session post-upgrade. Zu ran the "Done With You" kickoff while Sebastian set up Facebook/Instagram access simultaneously. Enrollment status mapped in detail: Burlington 56% (priority 1), Woburn 74%, Chelmsford 77%. Geographic targeting and demographic strategy built out — heavy focus on Asian/Indian family segments in Lexington, Winchester, Westford. Referral program and email campaign improvements identified as immediate wins.',
      quotes: [
        '"Burlington had a bad principal a couple years ago — damaged culture, killed word-of-mouth." — Kate Latham',
        '"Lexington school system is now 40% Asian — families moving in specifically for school quality." — Rachel Van Emon',
        '"I\'ll give away a thousand bucks." — Rachel on launching referral program',
      ],
      right: [
        'Zu immediately identified Burlington as #1 priority (56% — broke word-of-mouth engine)',
        'Surfaced Asian/Indian demographic opportunity across all 3 locations — actionable and specific',
        'Sebastian set up Facebook access during the call — working session, not just planning',
        'Treated Kate as a marketing partner, not a client to educate from scratch (she knew her markets)',
        'Identified referral program as low-hanging fruit — Rachel ready to fund it immediately',
      ],
      risks: [
        'Facebook Pixel status unknown — if no pixel, conversion tracking is a gap',
        'Burlington reputation damage may take longer than expected to reverse',
        'Chelmsford at a lower tuition tier than the other two — needs different messaging',
        'ProCare email is good content but lacks persistent enrollment CTAs',
      ],
      next: 'Sebastian completed Facebook access for Woburn and Chelmsford. Zu to share Bruce\'s referral framework. Next session: M3 workspace walkthrough, email CTA optimization, referral launch plan.',
    },
  ];

  const openThreads = [
    { title: 'Greg / Primrose Corporate Decision', status: 'PENDING', color: PO, body: 'Bruce reached out to Greg post June 30 call to position GYC as approved SEO/AIO vendor. Kate volunteered her 3 locations as pilot. Decision timeline TBD. If approved: GYC works with 590 Primrose schools.' },
    { title: '590 Schools Opportunity', status: 'OPEN', color: PG, body: 'Primrose corporate already piloted Digital Spice (50 schools). GYC is positioned as a second option. Kate/Rachel\'s heat map progress (March → June) is the proof of concept Bruce brings to Greg.' },
    { title: 'Rachel — Core + Growth Upsell', status: 'POTENTIAL', color: PP, body: 'Rachel said "hook, line, and sinker" on June 23 about expanding beyond Core. Tour training, reviews playbook, and Growth package are natural next steps after initial results land.' },
    { title: 'Facebook Pixel Installation', status: 'UNKNOWN', color: '#e03c31', body: 'Kate didn\'t know if a pixel was installed (July 7). If missing, GYC is flying blind on ad performance. Sebastian to investigate. Priority fix before Meta ads run.' },
    { title: 'Referral Program Launch', status: 'READY', color: PG, body: 'Rachel is ready to fund it ($1K/referral). Zu to share Bruce\'s framework. Best timing: back-to-school season. Lowest-effort, highest-trust marketing lever available.' },
  ];

  const typeBadge = (type: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      SALES: { bg: '#dbeafe', color: '#1d4ed8' },
      ACCOUNT: { bg: '#dcfce7', color: '#166534' },
      CORPORATE: { bg: '#f3e8ff', color: '#6b21a8' },
      ONBOARDING: { bg: '#fef3c7', color: '#92400e' },
    };
    const s = map[type] || { bg: '#f3f4f6', color: '#374151' };
    return <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>{type}</span>;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'Poppins, sans-serif' }}>
      {/* Google Fonts */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700&family=Poppins:wght@300;400;500;600&display=swap');`}</style>

      {/* Header */}
      <div style={{ background: PG, color: '#fff', padding: '2rem 2rem 1.5rem' }}>
        <Link href="/primrose" style={{ display: 'inline-flex', alignItems: 'center', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontSize: 14, marginBottom: 16 }}>
          <ArrowLeft size={14} style={{ marginRight: 6 }} /> Back to Primrose Hub
        </Link>
        <h1 style={{ fontFamily: 'Source Serif 4, serif', fontSize: '2.25rem', fontWeight: 700, margin: '0 0 4px' }}>KATE LATHAM — THE FULL STORY</h1>
        <p style={{ opacity: 0.85, margin: '0 0 1.5rem', fontSize: 16 }}>From first client to corporate pilot — every thread that went GYC's way</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {[['~18 mo', 'Client relationship'], ['3 Locations', 'Core + Blueprint'], ['C-Suite', 'Corporate intro'], ['590', 'School opportunity'], ['114 min', 'Key pitch meeting']].map(([v, l]) => (
            <div key={l} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 18px' }}>
              <div style={{ fontWeight: 700, fontSize: 20 }}>{v}</div>
              <div style={{ opacity: 0.8, fontSize: 12 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        {/* Timeline */}
        <section style={{ marginBottom: '3.5rem' }}>
          <h2 style={{ fontFamily: 'Source Serif 4, serif', color: PG, fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calendar size={22} /> Timeline
          </h2>
          <div style={{ borderLeft: `3px solid ${PG}`, paddingLeft: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {timelineEvents.map((ev, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: -38, top: 6, width: 14, height: 14, background: PG, borderRadius: '50%', border: '3px solid #fff', boxShadow: `0 0 0 2px ${PG}` }} />
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1.25rem 1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, color: PG, fontSize: 14 }}>{ev.date}</span>
                    {typeBadge(ev.type)}
                    {ev.duration && <span style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={13} />{ev.duration}</span>}
                  </div>
                  <div style={{ fontFamily: 'Source Serif 4, serif', fontWeight: 700, fontSize: '1.1rem', color: '#111', marginBottom: 8 }}>{ev.title}</div>
                  <p style={{ color: '#374151', fontSize: 14, margin: '0 0 10px', lineHeight: 1.6 }}>{ev.summary}</p>
                  {ev.quote && (
                    <div style={{ borderLeft: `3px solid #93c5fd`, background: '#eff6ff', padding: '8px 12px', borderRadius: '0 6px 6px 0', marginBottom: 10 }}>
                      <p style={{ fontSize: 13, color: '#1e40af', fontStyle: 'italic', margin: 0 }}>{ev.quote}</p>
                    </div>
                  )}
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <TrendingUp size={14} style={{ color: PO, marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, color: '#92400e', fontSize: 12, marginBottom: 2 }}>WHAT MOVED THE NEEDLE</div>
                      <p style={{ fontSize: 13, color: '#78350f', margin: 0 }}>{ev.needle}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Turning Points */}
        <section style={{ marginBottom: '3.5rem' }}>
          <h2 style={{ fontFamily: 'Source Serif 4, serif', color: PG, fontSize: '1.75rem', fontWeight: 700, marginBottom: 6 }}>The Turning Points</h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: 14 }}>Eight specific threads that went GYC's way</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {turningPoints.map((tp, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ background: '#f0f3e8', borderRadius: 8, padding: 8 }}>
                    <CheckCircle size={16} style={{ color: PG }} />
                  </div>
                  <div style={{ fontWeight: 700, color: '#111', fontSize: 15 }}>{i + 1}. {tp.title}</div>
                </div>
                <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6 }}>{tp.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Call Details */}
        <section style={{ marginBottom: '3.5rem' }}>
          <h2 style={{ fontFamily: 'Source Serif 4, serif', color: PG, fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem' }}>Each Call, In Detail</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {callDetails.map((call, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <button
                  onClick={() => setExpandedCall(expandedCall === i ? null : i)}
                  style={{ width: '100%', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>{call.date}</span>
                      <span style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={13} />{call.duration}</span>
                      <span style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}><Users size={13} />{call.attendees.length} people</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#374151', margin: 0, maxWidth: 700 }}>{call.summary.slice(0, 160)}…</p>
                  </div>
                  {expandedCall === i ? <ChevronUp size={18} style={{ color: '#9ca3af', flexShrink: 0 }} /> : <ChevronDown size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />}
                </button>

                {expandedCall === i && (
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: '1.5rem' }}>
                    {/* Attendees */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontWeight: 600, color: PG, fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Users size={13} />ATTENDEES</div>
                      <ul style={{ margin: 0, paddingLeft: 20, color: '#374151', fontSize: 13, lineHeight: 1.8 }}>
                        {call.attendees.map((a, j) => <li key={j}>{a}</li>)}
                      </ul>
                    </div>

                    {/* Full Summary */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontWeight: 600, color: '#374151', fontSize: 13, marginBottom: 6 }}>FULL SUMMARY</div>
                      <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.7 }}>{call.summary}</p>
                    </div>

                    {/* Quotes */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontWeight: 600, color: '#374151', fontSize: 13, marginBottom: 8 }}>KEY QUOTES</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {call.quotes.map((q, j) => (
                          <div key={j} style={{ borderLeft: `3px solid #93c5fd`, background: '#eff6ff', padding: '8px 12px', borderRadius: '0 6px 6px 0' }}>
                            <p style={{ fontSize: 13, color: '#1e40af', fontStyle: 'italic', margin: 0 }}>{q}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Two-column: Right + Risks */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '1rem' }}>
                        <div style={{ fontWeight: 600, color: '#166534', fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Award size={13} />WHAT GYC DID RIGHT</div>
                        <ul style={{ margin: 0, paddingLeft: 18, color: '#15803d', fontSize: 13, lineHeight: 1.8 }}>
                          {call.right.map((r, j) => <li key={j}>{r}</li>)}
                        </ul>
                      </div>
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '1rem' }}>
                        <div style={{ fontWeight: 600, color: '#92400e', fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={13} />RISKS</div>
                        <ul style={{ margin: 0, paddingLeft: 18, color: '#78350f', fontSize: 13, lineHeight: 1.8 }}>
                          {call.risks.map((r, j) => <li key={j}>{r}</li>)}
                        </ul>
                      </div>
                    </div>

                    {/* What Happened Next */}
                    <div style={{ background: '#f0f3e8', borderRadius: 8, padding: '0.75rem 1rem', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <TrendingUp size={14} style={{ color: PG, marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600, color: PG, fontSize: 12, marginBottom: 2 }}>WHAT HAPPENED NEXT</div>
                        <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>{call.next}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Client Intelligence */}
        <section style={{ marginBottom: '3.5rem' }}>
          <h2 style={{ fontFamily: 'Source Serif 4, serif', color: PG, fontSize: '1.75rem', fontWeight: 700, marginBottom: 6 }}>What This Tells Us About Kate (& Rachel)</h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: 14 }}>Intelligence based on everything documented so far</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {[
              { title: 'Decision-Making Style', body: 'Data-driven but action-oriented. Kate doesn\'t wait for corporate approval. She values trust, transparency, and results over process. "Asking forgiveness not permission" energy.' },
              { title: 'What Motivates Kate', items: ['Fill Burlington (56% — the bleeding wound)', 'Activate the 3,500+ lead email database', 'Rebuild word-of-mouth broken by bad principal', 'Prove GYC\'s value to corporate (pilot = her reputation)'] },
              { title: 'Trust Signals Kate Responds To', items: ['Organized the C-suite meeting herself', 'Followed through on Greg dinner unprompted', 'Offered the pilot — GYC didn\'t ask', 'Gave Bruce strategic advice on how to approach Greg', 'Upgraded despite Meta budget concern'] },
              { title: 'Pressure Points', items: ['Bad principal era (Burlington reputation still recovering)', 'Corporate constraints (GBP, brand control, ad restrictions)', '$107/click frustration with Drive agency', 'Primrose co-op shutting down (forced decision)', 'Burlington hitting 55% FTE in September'] },
              { title: 'Who Really Runs This', body: 'Rachel = owner. Economic buyer. Makes final decisions. Highly hands-on. Sales training background (husband ran sales orgs for 30 years). Kate = day-to-day. Champion. Corporate liaison. Both need to be won. Rachel is the money. Kate is the relationship.' },
              { title: 'How to Keep Winning', items: ['Show enrollment lift on Burlington (prove the model)', 'Launch the referral program (Rachel is funding it)', 'Push for GBP access (make manual posting annoying enough)', 'Keep Kate informed on Greg conversations (she\'s the bridge)', 'Deliver M3 automation (reduce Kate\'s manual workload)'] },
            ].map((card, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontWeight: 700, color: '#111', fontSize: 15, marginBottom: 10 }}>{card.title}</div>
                {'body' in card
                  ? <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6 }}>{card.body}</p>
                  : <ul style={{ margin: 0, paddingLeft: 18, color: '#374151', fontSize: 13, lineHeight: 1.8 }}>
                      {(card as any).items.map((item: string, j: number) => <li key={j}>{item}</li>)}
                    </ul>
                }
              </div>
            ))}
          </div>
        </section>

        {/* Open Threads */}
        <section>
          <h2 style={{ fontFamily: 'Source Serif 4, serif', color: PG, fontSize: '1.75rem', fontWeight: 700, marginBottom: 6 }}>Open Threads</h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: 14 }}>What's still in play</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {openThreads.map((t, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, color: '#111', fontSize: 15 }}>{t.title}</div>
                  <span style={{ background: t.color, color: '#fff', padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>{t.status}</span>
                </div>
                <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6 }}>{t.body}</p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};

export default PrimroseJourneyClient;
