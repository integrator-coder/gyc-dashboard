'use client'

import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from 'recharts'

// Color palette for per-employee lines
const LINE_COLORS = [
  '#a66fcd','#22d3ee','#34d399','#fbbf24','#fb7185','#818cf8',
  '#f97316','#a3e635','#e879f9','#38bdf8','#4ade80','#facc15',
  '#f472b6','#94a3b8','#c084fc','#2dd4bf','#fb923c','#a78bfa',
  '#86efac','#67e8f9','#fde68a','#fca5a5','#d8b4fe','#6ee7b7',
]

const chartGrid = 'rgba(150, 160, 179, 0.14)'
const chartAxis = '#96A0B3'
const brandPrimary = '#a66fcd'

// Production team members for Lada's view
const PRODUCTION_TEAM = new Set([
  'Kaci Hawkins',
  'Sebastian E',
  'Surendran Haridoss',
  'Raju Miah',
  'Briana Stewart',
])

// Excluded from the This Week real-time capacity panel
const THIS_WEEK_EXCLUDE = new Set([
  'Bruce Spurr',
  'Sebastian E',
  'Hakeem Warner',
])

function Card({ label, value, sub, tone = 'default', tooltip }) {
  const toneCls = tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : tone === 'bad' ? 'text-rose-300' : 'text-white'
  return (
    <div className="surface-card rounded-2xl p-4">
      <div className="flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] executive-muted">
        {label}
      </div>
      <div className={`metric-card-value mt-2 text-2xl font-semibold ${toneCls}`}>{value}</div>
      {sub && <div className="mt-1 text-[13px] executive-muted">{sub}</div>}
    </div>
  )
}

function Panel({ title, sub, children, tone = 'neutral' }) {
  const rail = tone === 'good' ? '#34d399' : tone === 'warn' ? '#fbbf24' : tone === 'bad' ? '#fb7185' : 'var(--brand-primary-4)'
  return (
    <div className="surface-panel rounded-2xl p-5" style={{ boxShadow: `inset 3px 0 0 ${rail}, inset 0 1px 0 rgba(255,255,255,0.03), var(--brand-shadow)` }}>
      <div className="mb-4">
        <h3 className="font-semibold text-white">{title}</h3>
        {sub && <p className="mt-1 text-xs executive-muted">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

function UtilizationBar({ pct }) {
  let color = '#34d399' // green
  if (pct > 90 || pct < 30) color = '#fb7185' // red
  else if (pct > 80 || pct < 40) color = '#fbbf24' // amber

  return (
    <div className="relative h-2 w-full rounded-full bg-gray-800">
      <div
        className="absolute left-0 top-0 h-full rounded-full transition-all"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
      />
    </div>
  )
}

export default function HarvestPage({ isLada = false }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState({})
  const [users, setUsers] = useState([])
  const [clients, setClients] = useState([])
  const [services, setServices] = useState([])
  const [trends, setTrends] = useState({ months: [], totalHours: [], byUser: {} })
  const [mrrMap, setMrrMap] = useState({})
  const [weeklyData, setWeeklyData] = useState({ weeks: [], users: [] })
  const [thisWeek, setThisWeek] = useState({ users: [], weekStart: '' })
  const [expandedClient, setExpandedClient] = useState(null)
  const [clientDetail, setClientDetail] = useState({})

  useEffect(() => {
    let active = true

    // Fetch this-week separately (no cache, real-time)
    fetch('/api/harvest/this-week').then(r => r.json()).then(d => {
      if (active && !d.error) setThisWeek(d)
    })

    Promise.all([
      fetch('/api/harvest/summary').then(r => r.json()),
      fetch('/api/harvest/by-user').then(r => r.json()),
      fetch('/api/harvest/by-client').then(r => r.json()),
      fetch('/api/harvest/by-service').then(r => r.json()),
      fetch('/api/harvest/trends').then(r => r.json()),
      fetch('/api/harvest/client-mrr').then(r => r.json()),
      fetch('/api/harvest/weekly').then(r => r.json()),
    ])
      .then(([summaryData, usersData, clientsData, servicesData, trendsData, mrrData, weeklyRaw]) => {
        if (!active) return
        
        if (summaryData.error) throw new Error(summaryData.error)
        if (usersData.error) throw new Error(usersData.error)
        if (clientsData.error) throw new Error(clientsData.error)
        if (servicesData.error) throw new Error(servicesData.error)
        if (trendsData.error) throw new Error(trendsData.error)
        if (mrrData.error) throw new Error(mrrData.error)

        setSummary(summaryData)
        setUsers(usersData.users || [])
        setClients(clientsData.clients || [])
        setServices(servicesData.services || [])
        setTrends(trendsData)
        setMrrMap(mrrData.mrrMap || {})
        if (!weeklyRaw.error) setWeeklyData(weeklyRaw)
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false))

    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="text-4xl">⏳</div>
          <p className="mt-3 text-sm executive-muted">Loading Harvest data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="text-4xl">❌</div>
          <p className="mt-3 text-sm text-rose-300">{error}</p>
        </div>
      </div>
    )
  }

  const lastUpdated = summary.asOf ? new Date(summary.asOf).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }) : ''

  // Filter users for Lada's view + remove zero-hour rows
  const displayUsers = (isLada 
    ? users.filter(u => PRODUCTION_TEAM.has(u.name))
    : users
  ).filter(u => u.currentMonthHours > 0)

  // Enrich clients with MRR data
  const enrichedClients = clients.map(client => {
    const clientKey = client.name.toLowerCase()
    const mrrData = mrrMap[clientKey]
    const mrr = mrrData?.mrr || 0
    const dollarPerHour = client.currentMonthHours > 0 ? mrr / client.currentMonthHours : 0
    
    // High maintenance = lots of hours + low revenue
    const isHighMaintenance = client.currentMonthHours > 20 && mrr < 500

    return {
      ...client,
      mrr,
      dollarPerHour,
      isHighMaintenance,
    }
  })

  // Prepare trend chart data
  const trendChartData = trends.months.map((month, idx) => ({
    month,
    hours: trends.totalHours[idx],
  }))

  // Staff distribution chart data (sorted desc)
  const staffChartData = [...displayUsers]
    .filter(u => u.currentMonthHours > 0)
    .sort((a, b) => b.currentMonthHours - a.currentMonthHours)
    .map(u => ({ name: u.name.split(' ')[0], hours: u.currentMonthHours, fullName: u.name }))

  // Client distribution chart data (top 20 by hours)
  const clientChartData = [...enrichedClients]
    .filter(c => c.currentMonthHours > 0)
    .slice(0, 20)
    .sort((a, b) => b.currentMonthHours - a.currentMonthHours)
    .map(c => ({
      name: c.name.split(' - ')[0] || c.name.slice(0, 12),
      hours: c.currentMonthHours,
      fullName: c.name,
      isHighMaintenance: c.isHighMaintenance,
      mrr: c.mrr,
      dollarPerHour: c.dollarPerHour,
    }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-white">
          <span>🕐</span>
          <span>Harvest — Time & Productivity</span>
        </h1>
        <p className="mt-1 text-sm executive-muted">
          {isLada ? 'Production Team Overview' : 'Team-wide time tracking and utilization'}
          {lastUpdated && ` • Last updated ${lastUpdated}`}
        </p>
      </div>

      {/* Summary Cards */}
      {!isLada && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card 
            label="Total Hours MTD" 
            value={summary.totalHours || 0}
            sub={`${summary.month || ''}`}
          />
          <Card 
            label="Billable %" 
            value={`${summary.billablePct || 0}%`}
            sub={`${summary.billableHours || 0} hrs billable`}
            tone={summary.billablePct >= 80 ? 'good' : summary.billablePct >= 70 ? 'default' : 'warn'}
          />
          <Card 
            label="Team Utilization %" 
            value={`${summary.utilizationPct || 0}%`}
            sub={`${summary.totalCapacityHours || 0} hrs capacity`}
            tone={summary.utilizationPct >= 60 ? 'good' : summary.utilizationPct >= 40 ? 'default' : 'warn'}
          />
          <Card 
            label="Active Clients" 
            value={summary.activeClientsCount || 0}
            sub="This month"
          />
          <Card 
            label="Internal Hours MTD" 
            value={summary.internalHours || 0}
            sub="GYC internal"
          />
        </div>
      )}

      {/* This Week — Real-Time Capacity Panel */}
      {thisWeek.users.length > 0 && (
        <Panel title="⚡ This Week — Real-Time" sub={`Hours used vs capacity since ${thisWeek.weekStart ? new Date(thisWeek.weekStart + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'Monday'} · sorted by most used`}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {thisWeek.users
              .filter(u => !THIS_WEEK_EXCLUDE.has(u.name))
              .filter(u => !isLada || PRODUCTION_TEAM.has(u.name))
              .map((u, idx) => {
                const pct = u.pctUsed
                const barColor = pct >= 90 ? '#fb7185' : pct >= 70 ? '#fbbf24' : '#34d399'
                return (
                  <div key={idx} className="rounded-xl bg-gray-900 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-white truncate" title={u.name}>{u.name.split(' ')[0]}</span>
                      <span className="text-xs executive-muted">{pct}%</span>
                    </div>
                    <div className="mt-1 mb-2">
                      <span className="text-2xl font-bold" style={{ color: barColor }}>{u.hoursThisWeek}</span>
                      <span className="ml-1 text-xs executive-muted">hrs</span>
                    </div>
                    <div className="relative h-1.5 w-full rounded-full bg-gray-800">
                      <div className="absolute left-0 top-0 h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }} />
                    </div>
                    <div className="mt-1.5 text-[10px] text-right executive-muted">
                      <span className="text-emerald-400">{u.hoursRemaining}h left</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </Panel>
      )}

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Staff Distribution */}
        <Panel title="Staff Hours Distribution" sub={`Hours logged this month by team member`}>
          <div style={{ height: `${Math.max(staffChartData.length * 36, 200)}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={staffChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
                <XAxis type="number" stroke={chartAxis} style={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" stroke={chartAxis} style={{ fontSize: 11 }} width={72} />
                <Tooltip
                  formatter={(val, _, props) => [`${val} hrs`, props.payload.fullName]}
                  contentStyle={{ backgroundColor: 'rgba(30,30,40,0.95)', border: '1px solid rgba(150,160,179,0.2)', borderRadius: '8px' }}
                />
                <Bar dataKey="hours" fill={brandPrimary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Client Distribution */}
        {!isLada && (
          <Panel title="Top 20 Clients by Hours" sub="Hours logged this month — 🔴 = high hrs + low MRR">
            <div style={{ height: `${Math.max(clientChartData.length * 36, 200)}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clientChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
                  <XAxis type="number" stroke={chartAxis} style={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" stroke={chartAxis} style={{ fontSize: 11 }} width={72} />
                  <Tooltip
                    formatter={(val, _, props) => [
                      `${val} hrs${props.payload.isHighMaintenance ? ' ⚠️ High Maintenance' : ''}`,
                      `${props.payload.fullName}${props.payload.mrr > 0 ? ` · MRR $${Math.round(props.payload.mrr)}` : ''}${props.payload.dollarPerHour > 0 ? ` · $${Math.round(props.payload.dollarPerHour)}/hr` : ''}`,
                    ]}
                    contentStyle={{ backgroundColor: 'rgba(30,30,40,0.95)', border: '1px solid rgba(150,160,179,0.2)', borderRadius: '8px' }}
                  />
                  <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                    {clientChartData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.isHighMaintenance ? '#fb7185' : '#22d3ee'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        )}
      </div>

      {/* By Service Line (full admins only) */}
      {!isLada && (
        <Panel title="By Service Line" sub="Hours distribution by service type">
          <div className="space-y-3">
            {services.map((service, idx) => (
              <div key={idx}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-white">{service.name}</span>
                  <span className="executive-muted">{service.hours} hrs ({service.pct}%)</span>
                </div>
                <div className="relative h-2 w-full rounded-full bg-gray-800">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full"
                    style={{ width: `${service.pct}%`, backgroundColor: brandPrimary }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Weekly Employee Hours Chart */}
      {weeklyData.weeks.length > 0 && (
        <Panel title="Employee Hours — Weekly" sub="Hours per team member per week (last 16 weeks)">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData.weeks} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="week" stroke={chartAxis} style={{ fontSize: 10 }} interval={1} />
                <YAxis stroke={chartAxis} style={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(20,20,30,0.97)', border: '1px solid rgba(150,160,179,0.2)', borderRadius: '8px', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                {weeklyData.users
                  .filter(u => displayUsers.find(du => du.name === u))
                  .map((userName, idx) => (
                    <Line
                      key={userName}
                      type="monotone"
                      dataKey={userName}
                      stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))
                }
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* Detail Tables — side by side at the bottom */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* By Employee */}
        <Panel title={isLada ? 'Production Team Hours' : 'By Employee'} sub="Current month hours and utilization">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wider executive-muted">
                  <th className="pb-2">Name</th>
                  <th className="pb-2 text-right">Hrs MTD</th>
                  <th className="pb-2 text-right">Wk Avg</th>
                  {!isLada && <th className="pb-2 text-right">Billable</th>}
                  {!isLada && <th className="pb-2 text-right">Util%</th>}
                  <th className="pb-2 text-right">Last Mo</th>
                  <th className="pb-2 text-center">↕</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {displayUsers.map((user, idx) => {
                  const trendIcon = user.trend === 'up' ? '↑' : user.trend === 'down' ? '↓' : '→'
                  const trendColor = user.trend === 'up' ? 'text-emerald-300' : user.trend === 'down' ? 'text-rose-300' : 'text-gray-400'
                  const utilizationColor = !isLada
                    ? (user.utilizationPct > 90 || user.utilizationPct < 30) ? 'text-rose-300'
                      : (user.utilizationPct > 80 || user.utilizationPct < 40) ? 'text-amber-300'
                      : 'text-emerald-300'
                    : ''
                  return (
                    <tr key={idx} className="text-white">
                      <td className="py-2">{user.name}</td>
                      <td className="py-2 text-right font-semibold">{user.currentMonthHours}</td>
                      <td className="py-2 text-right text-gray-300">{user.weeklyAvg}</td>
                      {!isLada && <td className="py-2 text-right">{user.billableHours}</td>}
                      {!isLada && <td className={`py-2 text-right ${utilizationColor}`}>{user.utilizationPct}%</td>}
                      <td className="py-2 text-right text-gray-400">{user.lastMonthHours}</td>
                      <td className={`py-2 text-center ${trendColor}`}>{trendIcon}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* By Client — High Maintenance Detector */}
        {!isLada && (
          <Panel title="By Client — High Maintenance" sub="Top 50 clients by hours · ⚠️ = high hrs + low MRR" tone="neutral">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wider executive-muted">
                    <th className="pb-2">Client</th>
                    <th className="pb-2 text-right">Hrs MTD</th>
                    <th className="pb-2 text-right">Last Mo</th>
                    <th className="pb-2 text-right">MRR</th>
                    <th className="pb-2 text-right">$/hr</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {enrichedClients.map((client, idx) => {
                    const isExpanded = expandedClient === client.harvestId
                    const detail = clientDetail[client.harvestId]
                    return (
                      <>
                        <tr
                          key={idx}
                          className={`${client.isHighMaintenance ? 'text-rose-300' : 'text-white'} ${client.harvestId ? 'cursor-pointer hover:bg-gray-800/40' : ''}`}
                          onClick={() => {
                            if (!client.harvestId) return
                            if (isExpanded) { setExpandedClient(null); return }
                            setExpandedClient(client.harvestId)
                            if (!detail) {
                              fetch(`/api/harvest/client-projects?clientId=${client.harvestId}`)
                                .then(r => r.json())
                                .then(d => setClientDetail(prev => ({ ...prev, [client.harvestId]: d })))
                            }
                          }}
                        >
                          <td className="py-2 max-w-[160px] truncate" title={client.name}>
                            {client.isHighMaintenance && <span className="mr-1 text-xs">⚠️</span>}
                            {client.harvestId && <span className="mr-1 text-xs text-gray-500">{isExpanded ? '▼' : '▶'}</span>}
                            {client.name}
                          </td>
                          <td className="py-2 text-right font-semibold">{client.currentMonthHours}</td>
                          <td className="py-2 text-right text-gray-400">{client.lastMonthHours}</td>
                          <td className="py-2 text-right">{client.mrr > 0 ? `$${Math.round(client.mrr)}` : '—'}</td>
                          <td className="py-2 text-right">{client.dollarPerHour > 0 ? `$${Math.round(client.dollarPerHour)}` : '—'}</td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${idx}-detail`}>
                            <td colSpan={5} className="pb-3 pt-0">
                              {!detail ? (
                                <div className="ml-4 text-xs text-gray-500">Loading breakdown…</div>
                              ) : detail.error ? (
                                <div className="ml-4 text-xs text-rose-300">{detail.error}</div>
                              ) : (
                                <div className="ml-4 rounded-lg bg-gray-900 p-3 text-xs">
                                  <div className="grid grid-cols-3 gap-4">
                                    <div>
                                      <div className="mb-1.5 font-semibold text-gray-400 uppercase tracking-wide">By Project</div>
                                      {detail.byProject.map((p, i) => (
                                        <div key={i} className="flex justify-between py-0.5">
                                          <span className="text-gray-300 truncate mr-2" title={p.name}>{p.name}</span>
                                          <span className="text-white font-medium shrink-0">{p.hours}h</span>
                                        </div>
                                      ))}
                                    </div>
                                    <div>
                                      <div className="mb-1.5 font-semibold text-gray-400 uppercase tracking-wide">By Task</div>
                                      {detail.byTask.map((t, i) => (
                                        <div key={i} className="flex justify-between py-0.5">
                                          <span className="text-gray-300 truncate mr-2" title={t.name}>{t.name}</span>
                                          <span className="text-white font-medium shrink-0">{t.hours}h</span>
                                        </div>
                                      ))}
                                    </div>
                                    <div>
                                      <div className="mb-1.5 font-semibold text-gray-400 uppercase tracking-wide">By Person</div>
                                      {detail.byPerson.map((p, i) => (
                                        <div key={i} className="flex justify-between py-0.5">
                                          <span className="text-gray-300 truncate mr-2">{p.name}</span>
                                          <span className="text-white font-medium shrink-0">{p.hours}h</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>

      {/* Trends Chart (full admins only) */}
      {!isLada && (
        <Panel title="Trends — Last 6 Months" sub="Total hours per month">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="month" stroke={chartAxis} style={{ fontSize: 12 }} />
                <YAxis stroke={chartAxis} style={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(30, 30, 40, 0.95)',
                    border: '1px solid rgba(150, 160, 179, 0.2)',
                    borderRadius: '8px',
                  }}
                />
                <Line type="monotone" dataKey="hours" stroke={brandPrimary} strokeWidth={2} dot={{ fill: brandPrimary }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly breakdown table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wider executive-muted">
                  <th className="pb-2">Team Member</th>
                  {trends.months.map((month, idx) => (
                    <th key={idx} className="pb-2 text-right">{month}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {Object.entries(trends.byUser)
                  .sort(([, hoursA], [, hoursB]) => {
                    const sumA = hoursA.reduce((a, b) => a + b, 0)
                    const sumB = hoursB.reduce((a, b) => a + b, 0)
                    return sumB - sumA
                  })
                  .map(([userName, monthlyHours]) => (
                    <tr key={userName} className="text-white">
                      <td className="py-3">{userName}</td>
                      {monthlyHours.map((hours, idx) => (
                        <td key={idx} className="py-3 text-right">{hours || '—'}</td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  )
}
