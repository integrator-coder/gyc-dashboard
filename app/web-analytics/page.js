'use client'

import { useState, useEffect } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'

function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n || 0) }
function fmtMonth(m) {
  if (!m) return ''
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' })
}

const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444']

export default function WebAnalyticsPage() {
  const [data, setData]       = useState(null)
  const [historical, setHistorical] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/metrics/ga-overview').then(r => r.json()),
      fetch('/api/metrics/ga-historical').then(r => r.json()),
    ]).then(([overview, hist]) => {
      setData(overview)
      setHistorical(hist.monthly || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
    </div>
  )
  if (!data || data.error) return <div className="text-red-400 p-6">Failed to load analytics data.</div>

  const { clients, totals, lastSync, clientCount } = data

  // Portfolio traffic mix
  const totalSessions = totals.sessions
  const organic  = clients.reduce((s, c) => s + c.organicSearch, 0)
  const paid     = clients.reduce((s, c) => s + c.paidTotal, 0)
  const direct   = clients.reduce((s, c) => s + c.directSessions, 0)
  const social   = clients.reduce((s, c) => s + c.organicSocial, 0)
  const other    = totalSessions - organic - paid - direct - social

  const trafficMix = [
    { name: 'Organic Search', value: organic },
    { name: 'Direct',         value: direct },
    { name: 'Paid',           value: paid },
    { name: 'Social',         value: social },
    { name: 'Other',          value: Math.max(other, 0) },
  ].filter(d => d.value > 0)

  // Health buckets
  const highTraffic  = clients.filter(c => c.sessions >= 1000).length
  const midTraffic   = clients.filter(c => c.sessions >= 200 && c.sessions < 1000).length
  const lowTraffic   = clients.filter(c => c.sessions < 200).length
  const highBounce   = clients.filter(c => c.bounceRate > 70).length
  const noPaid       = clients.filter(c => c.paidTotal === 0).length

  // Top 5 performers
  const top5 = [...clients].sort((a, b) => b.sessions - a.sessions).slice(0, 5)

  // Top 5 worst bounce (min 100 sessions)
  const worstBounce = [...clients]
    .filter(c => c.sessions >= 100)
    .sort((a, b) => b.bounceRate - a.bounceRate)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Web Analytics</h1>
        <p className="text-gray-400 text-sm mt-1">{clientCount} active clients · Last 30 days · Synced {lastSync ? new Date(lastSync).toLocaleDateString() : '—'}</p>
      </div>

      {/* Portfolio KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Sessions',   value: fmt(totalSessions), sub: 'across portfolio' },
          { label: 'Total New Visitors', value: fmt(totals.newUsers), sub: 'last 30 days' },
          { label: 'Organic Search',   value: fmt(organic), sub: `${Math.round(organic/totalSessions*100)}% of traffic` },
          { label: 'Paid Traffic',     value: fmt(paid), sub: `${Math.round(paid/totalSessions*100)}% of traffic` },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm">{label}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
            <p className="text-gray-500 text-xs mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Traffic Mix + Health */}
      <div className="grid grid-cols-2 gap-4">
        {/* Pie */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Portfolio Traffic Mix</h2>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={trafficMix} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={2}>
                  {trafficMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 8 }}
                  formatter={(v, n) => [fmt(v) + ' sessions', n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {trafficMix.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-300">{d.name}</span>
                  <span className="text-white font-medium ml-auto pl-4">{Math.round(d.value / totalSessions * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Health breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Portfolio Health</h2>
          <div className="space-y-3">
            {[
              { label: 'High traffic (1k+ sessions)',  value: highTraffic,  color: 'text-green-400' },
              { label: 'Mid traffic (200–1k)',         value: midTraffic,   color: 'text-yellow-400' },
              { label: 'Low traffic (<200 sessions)',  value: lowTraffic,   color: 'text-red-400' },
              { label: 'High bounce rate (>70%)',      value: highBounce,   color: 'text-red-400' },
              { label: 'No paid traffic',              value: noPaid,       color: 'text-orange-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">{label}</span>
                <span className={`font-bold text-lg ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5-Year Traffic Source Trend */}
      {historical && historical.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-1">Traffic Source Trends — Portfolio</h2>
          <p className="text-gray-500 text-xs mb-4">Monthly sessions by channel across all clients</p>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={historical.map(m => ({ ...m, month: fmtMonth(m.month) }))} margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
              <defs>
                {[['organic','#3B82F6'],['paid','#10B981'],['direct','#8B5CF6'],['social','#F59E0B'],['referral','#EC4899']].map(([k, c]) => (
                  <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={c} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 10 }} interval={5} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickFormatter={fmt} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                formatter={(v, n) => [fmt(v), n]} />
              <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
              <Area type="monotone" dataKey="organicSearch"  name="Organic Search" stroke="#3B82F6" fill="url(#g-organic)" strokeWidth={2} />
              <Area type="monotone" dataKey="directSessions" name="Direct"         stroke="#8B5CF6" fill="url(#g-direct)"  strokeWidth={2} />
              <Area type="monotone" dataKey="paidSearch"     name="Paid Search"    stroke="#10B981" fill="url(#g-paid)"    strokeWidth={2} />
              <Area type="monotone" dataKey="organicSocial"  name="Social"         stroke="#F59E0B" fill="url(#g-social)"  strokeWidth={2} />
              <Area type="monotone" dataKey="referral"       name="Referral"       stroke="#EC4899" fill="url(#g-referral)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI Traffic Tracker */}
      {historical && historical.length > 0 && (() => {
        const aiMonths = historical.filter(m => m.aiTotal > 0)
        const latest   = aiMonths[aiMonths.length - 1]
        const prev     = aiMonths[aiMonths.length - 2]
        const totalAI  = aiMonths.reduce((s, m) => s + m.aiTotal, 0)
        const momGrowth = latest && prev && prev.aiTotal > 0
          ? Math.round((latest.aiTotal - prev.aiTotal) / prev.aiTotal * 100)
          : null
        const TIPPING_POINT = 1.0 // % of total traffic
        const currentPct = latest?.aiPct ?? 0
        const monthsToTipping = (() => {
          if (currentPct >= TIPPING_POINT) return 0
          // simple linear projection from last 6 months
          const last6 = aiMonths.slice(-6)
          if (last6.length < 2) return null
          const growth = (last6[last6.length-1].aiPct - last6[0].aiPct) / (last6.length - 1)
          if (growth <= 0) return null
          return Math.ceil((TIPPING_POINT - currentPct) / growth)
        })()

        return (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-white font-semibold">🤖 AI Traffic Tracker</h2>
                  <span className="bg-blue-900/40 text-blue-400 text-xs px-2 py-0.5 rounded-full border border-blue-800">Early Signal</span>
                </div>
                <p className="text-gray-500 text-xs mt-1">ChatGPT, Gemini, Perplexity, Copilot — portfolio aggregate</p>
              </div>
              {monthsToTipping !== null && (
                <div className="text-right">
                  <p className="text-gray-500 text-xs">Est. tipping point (1% of traffic)</p>
                  <p className="text-yellow-400 font-bold">{monthsToTipping} months</p>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: 'This Month', value: latest ? fmt(latest.aiTotal) : '—', sub: 'sessions from AI' },
                { label: 'Of Total Traffic', value: currentPct.toFixed(2) + '%', sub: `vs ${TIPPING_POINT}% tipping point`, color: currentPct >= 0.5 ? 'text-yellow-400' : 'text-white' },
                { label: 'Month-on-Month', value: momGrowth !== null ? (momGrowth > 0 ? '+' : '') + momGrowth + '%' : '—', sub: 'vs prior month', color: momGrowth > 0 ? 'text-green-400' : momGrowth < 0 ? 'text-red-400' : 'text-white' },
                { label: 'All-Time AI Sessions', value: fmt(totalAI), sub: 'since Jan 2023' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">{label}</p>
                  <p className={`text-xl font-bold mt-1 ${color || 'text-white'}`}>{value}</p>
                  <p className="text-gray-600 text-xs mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* Source breakdown + trend chart */}
            <div className="grid grid-cols-3 gap-4">
              {/* Source breakdown */}
              <div>
                <p className="text-gray-500 text-xs mb-2 uppercase tracking-wide">Sources (all-time)</p>
                {[
                  { label: 'ChatGPT', value: aiMonths.reduce((s,m) => s+m.aiChatgpt, 0) },
                  { label: 'Gemini',  value: aiMonths.reduce((s,m) => s+m.aiGemini, 0) },
                  { label: 'Perplexity', value: aiMonths.reduce((s,m) => s+m.aiPerplexity, 0) },
                  { label: 'Copilot', value: aiMonths.reduce((s,m) => s+m.aiCopilot, 0) },
                  { label: 'Other',   value: aiMonths.reduce((s,m) => s+m.aiOther, 0) },
                ].filter(d => d.value > 0).map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                    <span className="text-gray-400 text-sm">{label}</span>
                    <span className="text-white text-sm font-medium">{fmt(value)}</span>
                  </div>
                ))}
              </div>

              {/* Trend chart */}
              <div className="col-span-2">
                <p className="text-gray-500 text-xs mb-2 uppercase tracking-wide">Monthly AI sessions trend</p>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={aiMonths.map(m => ({ month: fmtMonth(m.month), ai: m.aiTotal, pct: m.aiPct }))}>
                    <defs>
                      <linearGradient id="ai-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="month" tick={{ fill: '#6B7280', fontSize: 9 }} interval={3} />
                    <YAxis tick={{ fill: '#6B7280', fontSize: 9 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }}
                      formatter={(v, n) => [v, n === 'ai' ? 'Sessions' : '% of traffic']} />
                    <Area type="monotone" dataKey="ai" name="ai" stroke="#3B82F6" fill="url(#ai-grad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Top performers + worst bounce */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Top 5 by Sessions</h2>
          <div className="space-y-3">
            {top5.map((c, i) => (
              <div key={c.acronym} className="flex items-center gap-3">
                <span className="text-gray-600 text-sm w-4">{i + 1}</span>
                <span className="text-white font-medium w-16">{c.acronym}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.round(c.sessions / top5[0].sessions * 100)}%` }} />
                </div>
                <span className="text-gray-300 text-sm w-12 text-right">{fmt(c.sessions)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-1">Highest Bounce Rate</h2>
          <p className="text-gray-500 text-xs mb-4">Min. 100 sessions</p>
          <div className="space-y-3">
            {worstBounce.map((c, i) => (
              <div key={c.acronym} className="flex items-center gap-3">
                <span className="text-gray-600 text-sm w-4">{i + 1}</span>
                <span className="text-white font-medium w-16">{c.acronym}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full" style={{ width: `${c.bounceRate}%` }} />
                </div>
                <span className="text-red-400 text-sm w-12 text-right">{c.bounceRate}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
