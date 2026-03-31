'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

function fmt$(v) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v||0)) }
function fmtN(v) { return new Intl.NumberFormat('en-US').format(Number(v||0)) }

function Pill({ children, tone = 'gray' }) {
  const s = {
    red:    'border-rose-500/30 bg-rose-500/10 text-rose-200',
    amber:  'border-amber-500/30 bg-amber-500/10 text-amber-200',
    green:  'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    violet: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
    gray:   'border-gray-600/30 bg-gray-600/10 text-gray-400',
  }
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${s[tone] || s.gray}`}>{children}</span>
}

function SectionHeader({ emoji, title, count, tone = 'gray' }) {
  const dotColor = { red: '#f87171', amber: '#fbbf24', green: '#34d399', gray: '#6b7280' }
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-base">{emoji}</span>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {count != null && (
        <span className="ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold"
          style={{ backgroundColor: `${dotColor[tone]}22`, color: dotColor[tone], border: `1px solid ${dotColor[tone]}44` }}>
          {count}
        </span>
      )}
    </div>
  )
}

function Card({ children }) {
  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-4">
      {children}
    </div>
  )
}

export default function ClientHealthMonitor() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mission-control/client-health')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch(e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Loading client health data…</div>
  if (error) return <div className="text-rose-300 text-sm">⚠️ {error}</div>

  const healthData = data
  const ov = healthData?.overview || {}
  const snapshotAsOf = null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">🏥 Client Health Monitor</h2>
          <p className="text-sm text-gray-400 mt-0.5">Portfolio-wide risk signals — billing, support, funnels, and conversion. Updated live from Stripe, Zendesk, and client funnel data.</p>
          {snapshotAsOf && <p className="text-[11px] text-gray-600 mt-1">Snapshot as of {new Date(snapshotAsOf).toLocaleString()}</p>}
        </div>
        <button onClick={load} className="rounded-xl border border-[var(--brand-border)] px-3 py-1.5 text-xs text-gray-400 hover:text-white transition">Refresh</button>
      </div>

      {/* Portfolio overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Active Clients', value: fmtN(ov.active), tone: 'green' },
          { label: 'Past Due', value: fmtN(ov.past_due), tone: Number(ov.past_due) > 5 ? 'red' : 'amber' },
          { label: 'Total MRR', value: fmt$(ov.total_mrr), tone: 'violet' },
          { label: 'Avg MRR/Client', value: fmt$(ov.avg_mrr), tone: 'gray' },
          { label: 'High Value (>$2k)', value: fmtN(ov.high_value_count), tone: 'violet' },
          { label: 'Low Value (<$200)', value: fmtN(ov.low_value_count), tone: 'gray' },
          { label: 'Ticket Escalations', value: fmtN(healthData?.ticketEscalations?.length), tone: Number(healthData?.ticketEscalations?.length) > 5 ? 'red' : 'amber' },
        ].map(({ label, value, tone }) => (
          <div key={label} className="rounded-xl border border-[var(--brand-border)] bg-black/30 px-3 py-3">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
            <p className={`text-xl font-bold mt-1 ${tone === 'red' ? 'text-rose-300' : tone === 'amber' ? 'text-amber-300' : tone === 'green' ? 'text-emerald-300' : tone === 'violet' ? 'text-violet-300' : 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* 🔴 Billing Risk — Past Due */}
        <Card>
          <SectionHeader emoji="💳" title="Billing Risk — Past Due" count={healthData?.billingRisk?.length} tone="red" />
          <p className="text-[11px] text-gray-500 mb-3">Active subscriptions with failed/missing payment. MRR at risk.</p>
          {!healthData?.billingRisk?.length ? (
            <p className="text-sm text-emerald-300">✓ No past-due clients right now</p>
          ) : (
            <div className="space-y-2">
              {data.billingRisk.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{c.name}</p>
                    <p className="text-gray-500 text-xs truncate">{c.email}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-rose-300 font-semibold">{fmt$(c.mrr)}<span className="text-gray-500 text-xs">/mo</span></p>
                    <Pill tone="red">past due</Pill>
                  </div>
                </div>
              ))}
              <p className="text-xs text-gray-600 pt-1">Total at-risk MRR: {fmt$(data.billingRisk.reduce((s,c)=>s+Number(c.mrr||0),0))}</p>
            </div>
          )}
        </Card>

        {/* 🎫 Zendesk Escalations */}
        <Card>
          <SectionHeader emoji="🎫" title="Zendesk Escalations (10+ open tickets)" count={healthData?.ticketEscalations?.length} tone={healthData?.ticketEscalations?.length > 5 ? 'red' : 'amber'} />
          <p className="text-[11px] text-gray-500 mb-3">Clients with high open ticket volume — likely experiencing unresolved service issues.</p>
          {!healthData?.ticketEscalations?.length ? (
            <p className="text-sm text-emerald-300">✓ No clients at escalation threshold</p>
          ) : (
            <div className="space-y-2">
              {data.ticketEscalations.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{c.orgName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-amber-300 font-bold text-base">{c.openCount}</span>
                    <span className="text-gray-500 text-xs">open</span>
                    {c.acronym && c.acronym.length <= 8 && (
                      <Link href={`/clients/${c.acronym}`} className="text-[11px] text-violet-400 hover:text-violet-200 transition">View →</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 📉 Poor Conversion */}
        <Card>
          <SectionHeader emoji="📉" title="Funnel Conversion — Lowest Performers" count={healthData?.poorConversion?.length} tone="amber" />
          <p className="text-[11px] text-gray-500 mb-3">Clients with 5+ leads in last 90 days but lowest lead-to-enrollment conversion rate.</p>
          {!healthData?.poorConversion?.length ? (
            <p className="text-sm text-gray-400">No funnel conversion data available yet.</p>
          ) : (
            <div className="space-y-2">
              {data.poorConversion.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--brand-border)] bg-black/20 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-white font-medium">{c.name || c.acronym}</p>
                    <p className="text-gray-500 text-xs">{fmtN(c.total_leads)} leads · {fmtN(c.total_registrations)} enrolled</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`font-bold text-base ${Number(c.conversion_pct) < 3 ? 'text-rose-300' : Number(c.conversion_pct) < 8 ? 'text-amber-300' : 'text-gray-300'}`}>
                      {c.conversion_pct}%
                    </p>
                    {c.acronym && (
                      <Link href={`/clients/${c.acronym}`} className="text-[11px] text-violet-400 hover:text-violet-200 transition">View →</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 💰 MRR Concentration Risk */}
        <Card>
          <SectionHeader emoji="💰" title="MRR Concentration — Top 10 Clients" count={null} tone="violet" />
          <p className="text-[11px] text-gray-500 mb-3">How much of your MRR is concentrated in your biggest clients. High concentration = churn risk.</p>
          {!healthData?.mrrConcentration?.length ? (
            <p className="text-sm text-gray-400">No data available.</p>
          ) : (
            <div className="space-y-1.5">
              {data.mrrConcentration.map((c, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-gray-600 text-[11px] w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-gray-200 truncate text-xs">{c.name}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-violet-300 font-semibold text-xs">{fmt$(c.mrr)}</span>
                        <span className="text-gray-500 text-[11px]">{c.pct_of_mrr}%</span>
                      </div>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full overflow-hidden bg-gray-800">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(Number(c.pct_of_mrr) * 3, 100)}%`, backgroundColor: Number(c.pct_of_mrr) > 3 ? '#AE2BCF' : '#4a3060' }} />
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-gray-600 pt-1">
                Top 10 = {fmt$(data.mrrConcentration.reduce((s,c)=>s+Number(c.mrr||0),0))} · {
                  Math.round(data.mrrConcentration.reduce((s,c)=>s+Number(c.pct_of_mrr||0),0))
                }% of total MRR
              </p>
            </div>
          )}
        </Card>

      </div>

      {/* Zendesk all open tickets table */}
      <Card>
        <SectionHeader emoji="📋" title="All Open Ticket Volume by Client" count={null} tone="gray" />
        <p className="text-[11px] text-gray-500 mb-3">Every client with open Zendesk tickets, ranked by volume. Click name to open Client Intel.</p>
        <div className="overflow-x-auto rounded-xl border border-[var(--brand-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr style={{borderBottom:'1px solid #2a1a3e'}}>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Client</th>
                <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Open Tickets</th>
                <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Risk</th>
                <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider text-gray-500 font-semibold">View</th>
              </tr>
            </thead>
            <tbody>
              {(healthData?.zdTopOrgs || []).map((c, i) => {
                const tone = c.openCount >= 15 ? 'red' : c.openCount >= 10 ? 'amber' : 'gray'
                const acronym = c.acronym?.length <= 8 ? c.acronym : null
                return (
                  <tr key={i} style={{borderBottom: i < (healthData?.zdTopOrgs?.length||0)-1 ? '1px solid #1a0a2e' : 'none'}} className="hover:bg-white/5">
                    <td className="px-4 py-2.5 text-gray-200">{c.orgName}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-bold ${tone === 'red' ? 'text-rose-300' : tone === 'amber' ? 'text-amber-300' : 'text-gray-300'}`}>{c.openCount}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right"><Pill tone={tone}>{tone === 'red' ? 'High' : tone === 'amber' ? 'Medium' : 'Low'}</Pill></td>
                    <td className="px-4 py-2.5 text-right">
                      {acronym && <Link href={`/clients/${acronym}`} className="text-xs text-violet-400 hover:text-violet-200 transition">Intel →</Link>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  )
}
