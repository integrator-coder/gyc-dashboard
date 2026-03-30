'use client'

import { useEffect, useState } from 'react'
import CommissionTierTracker from '@/components/CommissionTierTracker'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts'

const fmt$ = (n) => '$' + Math.round(n).toLocaleString()
const fmtK = (n) => n >= 1000 ? '$' + (n / 1000).toFixed(0) + 'K' : '$' + Math.round(n)

const REPS_ORDER = ['Jesse', 'Briana', 'Sebastian', 'JC', 'Zu', 'Pia', 'Todd']
const TEAL = '#14B8A6'
const GRAY = '#374151'
const TEAL_LIGHT = '#2DD4BF'
const AMBER = '#F59E0B'

function KpiCard({ label, value, sub, highlight }) {
  return (
    <div className={`rounded-xl border p-5 ${highlight ? 'bg-teal-950 border-teal-700' : 'bg-gray-900 border-gray-800'}`}>
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-teal-300' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

const BarTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
      <p className="text-white font-semibold mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {fmt$(p.value)}
          {p.payload[`count${p.name.replace('20','')}`] != null
            ? ` (${p.payload[`count${p.name.replace('20','')}`]} deals)` : ''}
        </p>
      ))}
    </div>
  )
}

const LineTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
      <p className="text-white font-semibold mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {fmt$(p.value)}</p>
      ))}
    </div>
  )
}

export default function NewBusinessPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/metrics/new-business')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Loading new business data…</div>
  )
  if (error || data?.error) return (
    <div className="text-red-400 p-6">Error: {error || data.error}</div>
  )

  const { summary, monthlyComparison, repYTD, repThisMonth, repPifYTD, repPifMonth, recentDeals, renewalProjection, missingRenewal, commissionTracker, salesVsUpsells } = data
  const { pif, mrr } = summary

  // Rep leaderboard
  const repLeaderboard = REPS_ORDER
    .filter(r => repYTD[r])
    .map(r => ({
      rep: r,
      ytd: repYTD[r]?.fullTerm || 0,
      ytdCount: repYTD[r]?.count || 0,
      month: repThisMonth[r]?.fullTerm || 0,
      monthCount: repThisMonth[r]?.count || 0,
    }))
    .sort((a, b) => b.ytd - a.ytd)

  for (const [rep, vals] of Object.entries(repYTD)) {
    if (!REPS_ORDER.includes(rep) && rep !== 'Unknown') {
      repLeaderboard.push({ rep, ytd: vals.fullTerm, ytdCount: vals.count, month: repThisMonth[rep]?.fullTerm || 0, monthCount: repThisMonth[rep]?.count || 0 })
    }
  }

  const maxYTD = Math.max(...repLeaderboard.map(r => r.ytd), 1)

  // PIF donut data
  const pifDonut26 = [
    { name: 'Paid in Full', value: Math.round(pif.fp26) },
    { name: 'Recurring', value: Math.round(summary.ytdFirstPayment - pif.fp26) },
  ]
  const pifDonut25 = [
    { name: 'Paid in Full', value: Math.round(pif.fp25) },
    { name: 'Recurring', value: Math.round(summary.q1_2025 - pif.fp25) },
  ]

  // MRR line data — only months that have data
  const mrrLineData = monthlyComparison.filter(m => m.mrr26 > 0 || m.mrr25 > 0)

  // PIF stacked bar — 2026 only (PIF vs recurring by month)
  const pifStackData = monthlyComparison.filter(m => m['2026'] > 0).map(m => ({
    month: m.month,
    'Paid in Full': m.pif26,
    'Recurring': m.recur26,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">New Business</h1>
        <p className="text-gray-400 text-sm mt-1">
          First payments · MRR · PIF breakdown · Updated {new Date(data.updatedAt).toLocaleTimeString()}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="YTD New Money" value={fmt$(summary.ytdFirstPayment)} sub={`${summary.ytdDeals} deals`} highlight />
        <KpiCard label={`${summary.currentMonth} New Money`} value={fmt$(summary.thisMonthFirstPayment)} sub={`${summary.thisMonthDeals} deals`} />
        <KpiCard label="Avg Deal Size" value={fmt$(summary.ytdAvgDeal)} sub="YTD avg first payment" />
        <KpiCard label="Q1 YoY Growth" value={summary.yoyPct != null ? `+${Math.round(summary.yoyPct)}%` : '—'} sub={`${fmt$(summary.q1_2025)} → ${fmt$(summary.q1_2026)}`} />
        <KpiCard label={`${summary.currentMonth} New MRR`} value={fmt$(summary.thisMonthMRR)} sub="Recurring portion only" />
      </div>

      {/* Row 2 — YoY First Payment + YoY Deal Count */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* YoY First Payment Bar Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-1">New Money — 2026 vs 2025</h2>
          <p className="text-gray-500 text-xs mb-4">First payments by month</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyComparison} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis tickFormatter={fmtK} tick={{ fill: '#9CA3AF', fontSize: 11 }} width={48} />
              <Tooltip content={<BarTip />} />
              <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
              <Bar dataKey="2026" fill={TEAL} radius={[4,4,0,0]} />
              <Bar dataKey="2025" fill={GRAY} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* YoY Deal Count */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-1">Deal Count — 2026 vs 2025</h2>
          <p className="text-gray-500 text-xs mb-4">Number of new deals closed per month</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyComparison} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} width={32} />
              <Tooltip
                content={({ active, payload, label }) => active && payload?.length ? (
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
                    <p className="text-white font-semibold mb-1">{label}</p>
                    {payload.map(p => <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value} deals</p>)}
                  </div>
                ) : null}
              />
              <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
              <Bar dataKey="count26" name="2026" fill={TEAL} radius={[4,4,0,0]} />
              <Bar dataKey="count25" name="2025" fill={GRAY} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3 — PIF Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-1">Paid in Full vs Recurring</h2>
        <p className="text-gray-500 text-xs mb-4">How clients are paying — upfront vs monthly</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* PIF Donuts side by side */}
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="flex gap-8">
              {[['2026', pifDonut26, pif.pct26, pif.count26], ['2025', pifDonut25, pif.pct25, pif.count25]].map(([year, donut, pct, count]) => (
                <div key={year} className="flex flex-col items-center">
                  <p className="text-gray-400 text-xs mb-2">{year}</p>
                  <PieChart width={110} height={110}>
                    <Pie data={donut} cx={50} cy={50} innerRadius={32} outerRadius={50} dataKey="value" startAngle={90} endAngle={-270}>
                      <Cell fill={TEAL} />
                      <Cell fill={GRAY} />
                    </Pie>
                    <text x={50} y={46} textAnchor="middle" fill="#fff" fontSize={14} fontWeight="bold">{Math.round(pct)}%</text>
                    <text x={50} y={62} textAnchor="middle" fill="#9CA3AF" fontSize={10}>PIF</text>
                  </PieChart>
                  <p className="text-gray-500 text-xs mt-1">{count} PIF deals</p>
                </div>
              ))}
            </div>
            <div className="flex gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" /> PIF</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-700 inline-block" /> Recurring</span>
            </div>
          </div>

          {/* PIF stacked bar by month 2026 */}
          <div className="lg:col-span-2">
            <p className="text-gray-400 text-xs mb-2">2026 — PIF vs Recurring by Month</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pifStackData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <YAxis tickFormatter={fmtK} tick={{ fill: '#9CA3AF', fontSize: 11 }} width={48} />
                <Tooltip
                  content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
                      <p className="text-white font-semibold mb-1">{label}</p>
                      {payload.map(p => <p key={p.name} style={{ color: p.color }}>{p.name}: {fmt$(p.value)}</p>)}
                    </div>
                  ) : null}
                />
                <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                <Bar dataKey="Paid in Full" stackId="a" fill={TEAL} radius={[0,0,0,0]} />
                <Bar dataKey="Recurring" stackId="a" fill={GRAY} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 4 — MRR */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold">New MRR Added — 2026 vs 2025</h2>
            <p className="text-gray-500 text-xs mt-0.5">Monthly recurring revenue from new deals only (excludes PIF)</p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-gray-400 text-xs">2026 YTD MRR</p>
              <p className="text-teal-400 font-bold text-lg">{fmt$(mrr.ytd26)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">2025 Full Year</p>
              <p className="text-gray-300 font-bold text-lg">{fmt$(mrr.ytd25)}</p>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyComparison} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <YAxis tickFormatter={fmtK} tick={{ fill: '#9CA3AF', fontSize: 11 }} width={48} />
            <Tooltip content={<LineTip />} />
            <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
            <Line type="monotone" dataKey="mrr26" name="2026 MRR" stroke={TEAL} strokeWidth={2.5} dot={{ fill: TEAL, r: 4 }} />
            <Line type="monotone" dataKey="mrr25" name="2025 MRR" stroke={GRAY} strokeWidth={2} strokeDasharray="4 2" dot={{ fill: GRAY, r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Renewal MRR Projection */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-white font-semibold">Projected MRR Renewals</h2>
            <p className="text-gray-500 text-xs mt-0.5">When PIF deals expire and convert to monthly billing</p>
          </div>
          {missingRenewal?.length > 0 && (
            <div className="text-right">
              <span className="text-amber-400 text-xs font-medium">⚠️ {missingRenewal.length} deals missing renewal amounts</span>
              <p className="text-gray-500 text-xs mt-0.5">Chart understates future months</p>
            </div>
          )}
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={renewalProjection} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={48} />
            <YAxis tickFormatter={fmtK} tick={{ fill: '#9CA3AF', fontSize: 11 }} width={48} />
            <Tooltip
              content={({ active, payload, label }) => active && payload?.length ? (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm max-w-xs">
                  <p className="text-white font-semibold mb-2">{label}</p>
                  <p className="text-teal-400 font-medium">{fmt$(payload[0].value)}/mo MRR</p>
                  {payload[0].payload.deals?.map((d, i) => (
                    <p key={i} className="text-gray-400 text-xs mt-1">{d.name} — {fmt$(d.renewal)}/mo</p>
                  ))}
                </div>
              ) : null}
            />
            <Bar dataKey="mrr" name="New MRR" fill={TEAL} radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Missing renewal callout */}
        {missingRenewal?.length > 0 && (() => {
          const byMonth = {}
          missingRenewal.forEach(m => {
            if (!byMonth[m.renewalMonth]) byMonth[m.renewalMonth] = { count: 0, fp: 0 }
            byMonth[m.renewalMonth].count++
            byMonth[m.renewalMonth].fp += m.fp
          })
          const upcoming = Object.entries(byMonth)
            .filter(([mo]) => new Date(mo) >= new Date())
            .sort((a,b) => new Date(a[0]) - new Date(b[0]))
          if (!upcoming.length) return null
          return (
            <div className="mt-4 border border-amber-900/50 bg-amber-950/30 rounded-lg p-3">
              <p className="text-amber-300 text-sm font-semibold mb-1">⚠️ Why this warning appears</p>
              <p className="text-amber-200/90 text-xs leading-relaxed mb-2">
                This chart forecasts renewal MRR for PIF deals at their renewal month (based on term length). If a PIF deal has no renewal amount entered,
                that renewal month will show lower projected MRR than reality.
              </p>
              <p className="text-amber-200/80 text-xs mb-3">
                In other words: these months are <span className="font-semibold">understated</span> until renewal values are filled in on the source sales sheet.
              </p>
              <div className="flex flex-wrap gap-3">
                {upcoming.map(([mo, data]) => (
                  <span key={mo} className="text-xs text-amber-300 bg-amber-950 px-2 py-1 rounded">
                    {mo}: {data.count} deal{data.count > 1 ? 's' : ''} missing renewal · {fmt$(data.fp)} PIF first-payment value
                  </span>
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Commission Tier Tracker */}
      <CommissionTierTracker
        commissionTracker={commissionTracker}
        currentMonth={summary.currentMonth}
      />

      {/* Rep Leaderboard */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">Rep Leaderboard — {summary.currentMonth} &amp; YTD <span className="text-gray-500 text-xs font-normal ml-1">(full term value)</span></h2>
        <div className="space-y-3">
          {repLeaderboard.map((rep, i) => (
            <div key={rep.rep} className="flex items-center gap-4">
              <span className="text-gray-500 text-sm w-5 text-right">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`}
              </span>
              <span className="text-white text-sm font-medium w-24">{rep.rep}</span>
              <div className="flex-1 bg-gray-800 rounded-full h-2">
                <div className="bg-teal-500 h-2 rounded-full transition-all" style={{ width: `${(rep.ytd / maxYTD) * 100}%` }} />
              </div>
              <div className="text-right w-32">
                <span className="text-white text-sm font-semibold">{fmt$(rep.ytd)}</span>
                <span className="text-gray-500 text-xs ml-1">({rep.ytdCount})</span>
              </div>
              <div className="text-right w-28 hidden lg:block">
                <span className="text-gray-400 text-xs">{summary.currentMonth.slice(0,3)}: </span>
                <span className="text-teal-400 text-sm font-medium">{rep.month > 0 ? fmt$(rep.month) : '—'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PIF Leaderboard */}
      {(() => {
        const pifLeaderboard = REPS_ORDER
          .filter(r => repPifYTD[r])
          .map(r => ({
            rep: r,
            ytd: repPifYTD[r]?.fullTerm || 0,
            ytdCount: repPifYTD[r]?.count || 0,
            month: repPifMonth[r]?.fullTerm || 0,
            monthCount: repPifMonth[r]?.count || 0,
          }))
          .sort((a, b) => b.ytd - a.ytd)

        for (const [rep, vals] of Object.entries(repPifYTD)) {
          if (!REPS_ORDER.includes(rep) && rep !== 'Unknown') {
            pifLeaderboard.push({ rep, ytd: vals.fullTerm, ytdCount: vals.count, month: repPifMonth[rep]?.fullTerm || 0, monthCount: repPifMonth[rep]?.count || 0 })
          }
        }

        if (!pifLeaderboard.length) return null
        const maxPifYTD = Math.max(...pifLeaderboard.map(r => r.ytd), 1)

        return (
          <div className="bg-gray-900 border border-amber-900/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-white font-semibold">PIF Leaderboard — {summary.currentMonth} &amp; YTD</h2>
              <span className="text-amber-400 text-xs font-bold px-2 py-0.5 bg-amber-950 rounded-full">PIF</span>
              <span className="text-gray-500 text-xs font-normal">(full term value)</span>
            </div>
            <p className="text-gray-500 text-xs mb-4">Paid-in-full deals only</p>
            <div className="space-y-3">
              {pifLeaderboard.map((rep, i) => (
                <div key={rep.rep} className="flex items-center gap-4">
                  <span className="text-gray-500 text-sm w-5 text-right">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`}
                  </span>
                  <span className="text-white text-sm font-medium w-24">{rep.rep}</span>
                  <div className="flex-1 bg-gray-800 rounded-full h-2">
                    <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${(rep.ytd / maxPifYTD) * 100}%` }} />
                  </div>
                  <div className="text-right w-32">
                    <span className="text-white text-sm font-semibold">{fmt$(rep.ytd)}</span>
                    <span className="text-gray-500 text-xs ml-1">({rep.ytdCount} PIF)</span>
                  </div>
                  <div className="text-right w-28 hidden lg:block">
                    <span className="text-gray-400 text-xs">{summary.currentMonth.slice(0,3)}: </span>
                    <span className="text-amber-400 text-sm font-medium">{rep.month > 0 ? fmt$(rep.month) : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Sales vs Upsells Split */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-1">Sales vs Upsells (Historical Rule-Based Split)</h2>
        <p className="text-gray-500 text-xs mb-4">Sales reps: Jesse, Pia, Briana, Matt, Lex (+ Sebastian in 2025) · Upsell reps: JC, Zu, Stefen, Todd, Travis, Kim (+ Sebastian in 2026)</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          {[['YTD 2026', salesVsUpsells?.ytd2026], [`${summary.currentMonth} 2026`, salesVsUpsells?.thisMonth2026]].map(([label, block]) => (
            <div key={label} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">{label}</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                    <th className="text-left pb-2">Type</th>
                    <th className="text-right pb-2">Deals</th>
                    <th className="text-right pb-2">First Payment</th>
                    <th className="text-right pb-2">MRR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {['Sales', 'Upsell', 'Unclassified'].map((type) => {
                    const row = block?.[type] || { count: 0, firstPayment: 0, mrr: 0 }
                    return (
                      <tr key={type}>
                        <td className="py-2 text-gray-200">{type}</td>
                        <td className="py-2 text-right text-white tabular-nums">{row.count || 0}</td>
                        <td className="py-2 text-right text-white tabular-nums">{fmt$(row.firstPayment || 0)}</td>
                        <td className="py-2 text-right text-gray-300 tabular-nums">{fmt$(row.mrr || 0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase border-b border-gray-800">
                <th className="text-left pb-2 pr-4">Rep</th>
                <th className="text-left pb-2 pr-4">Type</th>
                <th className="text-right pb-2 pr-4">Deals</th>
                <th className="text-right pb-2 pr-4">First Payment</th>
                <th className="text-right pb-2">Full Term</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {(salesVsUpsells?.byRep2026 || []).map((r) => (
                <tr key={r.rep} className="hover:bg-gray-800/50">
                  <td className="py-2.5 pr-4 text-white font-medium">{r.rep}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.type === 'Sales' ? 'text-teal-300 bg-teal-950' : r.type === 'Upsell' ? 'text-amber-300 bg-amber-950' : 'text-gray-300 bg-gray-800'}`}>{r.type}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-gray-300">{r.deals}</td>
                  <td className="py-2.5 pr-4 text-right text-white">{fmt$(r.firstPayment)}</td>
                  <td className="py-2.5 text-right text-gray-400">{fmt$(r.fullTerm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Deals */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">Recent Deals</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase border-b border-gray-800">
                <th className="text-left pb-2 pr-4">Date</th>
                <th className="text-left pb-2 pr-4">Client</th>
                <th className="text-left pb-2 pr-4">Service</th>
                <th className="text-left pb-2 pr-4">Rep</th>
                <th className="text-left pb-2 pr-4">Type</th>
                <th className="text-center pb-2 pr-4">PIF</th>
                <th className="text-right pb-2 pr-4">First Payment</th>
                <th className="text-right pb-2">Full Term</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {recentDeals.map((deal, i) => (
                <tr key={i} className="hover:bg-gray-800/50">
                  <td className="py-2.5 pr-4 text-gray-400">{deal.date}</td>
                  <td className="py-2.5 pr-4 text-white font-medium">{deal.name}</td>
                  <td className="py-2.5 pr-4 text-gray-300">{deal.service}</td>
                  <td className="py-2.5 pr-4">
                    <span className="text-teal-400 text-xs font-medium px-2 py-0.5 bg-teal-950 rounded-full">{deal.rep}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${deal.dealType === 'Sales' ? 'text-teal-300 bg-teal-950' : deal.dealType === 'Upsell' ? 'text-amber-300 bg-amber-950' : 'text-gray-300 bg-gray-800'}`}>{deal.dealType || 'Unclassified'}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-center">
                    {deal.pif ? <span className="text-amber-400 text-xs font-bold">PIF</span> : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-white">{fmt$(deal.firstPayment)}</td>
                  <td className="py-2.5 text-right text-gray-400">{fmt$(deal.fullTerm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
