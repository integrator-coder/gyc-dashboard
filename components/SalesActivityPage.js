'use client'

import { useEffect, useState, useCallback } from 'react'
import KpiCard from '@/components/KpiCard'
import CommissionTierTracker from '@/components/CommissionTierTracker'

const VIEW_LABELS = ['Today', 'This Week', 'This Month', 'This Year']
const VIEW_KEYS = ['today', 'week', 'month', 'year']

const PRIMARY_METRICS = [
  { key: 'Agreements Closed', isRate: false, size: 'large' },
  { key: 'Close Rate', isRate: true },
  { key: 'Conversion Rate', isRate: true },
  { key: 'Show Rate', isRate: true },
  { key: 'Scheduled Calls', isRate: false },
  { key: 'Shown', isRate: false },
  { key: 'Agreements Sent', isRate: false },
  { key: 'New Inbound', isRate: false },
  { key: 'Follow ups', isRate: false },
]

const LOWER_IS_BETTER = new Set(['No Show', 'Cancelled'])

function getTarget(targets, metric, period) {
  const map = { today: 'daily', week: 'weekly', month: 'monthly' }
  return targets?.[map[period]]?.[metric] ?? null
}

function RepCard({ repName, repData, period, metrics, targets }) {
  if (!repData) {
    return (
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 opacity-50">
        <h3 className="text-white font-semibold mb-3">{repName}</h3>
        <p className="text-gray-600 text-sm">No data</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-[#340B67] flex items-center justify-center text-xs text-[#AE2BCF] font-bold">
          {repName[0]}
        </span>
        {repName}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map(({ key, isRate }) => {
          const actual = repData[key]?.[period] ?? 0
          const target = getTarget(targets, key, period)
          if (target === null) return null
          return (
            <KpiCard
              key={key}
              title={key}
              actual={actual}
              target={target}
              isRate={isRate}
              lowerIsBetter={LOWER_IS_BETTER.has(key)}
            />
          )
        })}
      </div>
    </div>
  )
}

function PiaCard({ repData, period }) {
  if (!repData) return null

  const piaMetrics = [
    { key: 'Outbound Activity', isRate: false },
    { key: 'Scheduled Calls', isRate: false },
    { key: 'Shown', isRate: false },
    { key: 'Show Rate', isRate: true },
  ]

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
      <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-purple-900 flex items-center justify-center text-xs text-purple-300 font-bold">
          P
        </span>
        Pia
        <span className="text-gray-600 text-xs font-normal">(Outbound)</span>
      </h3>
      <p className="text-gray-600 text-xs mb-4">No targets set yet — activity tracking only</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {piaMetrics.map(({ key, isRate }) => {
          const actual = repData[key]?.[period] ?? 0
          const displayVal = isRate
            ? `${(actual * 100).toFixed(1)}%`
            : Number.isInteger(actual) ? String(actual) : actual.toFixed(1)

          return (
            <div key={key} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">{key}</p>
              <p className="text-xl font-bold text-white">{displayVal}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatUpdated(isoStr) {
  if (!isoStr) return ''
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 60000)
  if (diff < 1) return 'just now'
  if (diff === 1) return '1 minute ago'
  return `${diff} minutes ago`
}

function formatCurrency(val) {
  if (!val && val !== 0) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
}

function MarketingMetricCard({ title, value, subtitle, accent = '#AE2BCF' }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
      <div className="w-10 h-1 rounded-full mb-3" style={{ backgroundColor: accent }} />
      <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">{title}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {subtitle && <p className="text-gray-600 text-xs mt-1">{subtitle}</p>}
    </div>
  )
}

export default function SalesPage() {
  const [data, setData] = useState(null)
  const [ghlData, setGhlData] = useState(null)
  const [leadsData, setLeadsData] = useState(null)
  const [dealSizeData, setDealSizeData] = useState(null)
  const [commissionData, setCommissionData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ghlLoading, setGhlLoading] = useState(true)
  const [marketingLoading, setMarketingLoading] = useState(true)
  const [commissionLoading, setCommissionLoading] = useState(true)
  const [error, setError] = useState(null)
  const [marketingError, setMarketingError] = useState(null)
  const [viewIdx, setViewIdx] = useState(2)

  const period = VIEW_KEYS[viewIdx]

  const fetchData = useCallback(async () => {
    try {
      const [salesRes, ghlRes] = await Promise.all([
        fetch('/api/metrics/sales-activity-snapshot'),
        fetch(`/api/metrics/ghl?period=${period}`)
      ])
      const [json, ghlJson] = await Promise.all([salesRes.json(), ghlRes.json()])
      if (json.error) throw new Error(json.error)
      setData(json)
      setGhlData(ghlJson.error ? null : ghlJson)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [period])

  const fetchMarketingData = useCallback(async () => {
    setMarketingLoading(true)
    try {
      const [leadsRes, dealSizeRes] = await Promise.all([
        fetch('/api/metrics/ghl-leads'),
        fetch('/api/metrics/deal-size'),
      ])
      const [leadsJson, dealSizeJson] = await Promise.all([leadsRes.json(), dealSizeRes.json()])
      if (leadsJson.error) throw new Error(leadsJson.error)
      if (dealSizeJson.error) throw new Error(dealSizeJson.error)
      setLeadsData(leadsJson)
      setDealSizeData(dealSizeJson)
      setMarketingError(null)
    } catch (err) {
      setMarketingError(err.message)
      setLeadsData(null)
      setDealSizeData(null)
    } finally {
      setMarketingLoading(false)
    }
  }, [])

  const fetchCommission = useCallback(async () => {
    setCommissionLoading(true)
    try {
      const res = await fetch('/api/metrics/commission')
      const json = await res.json()
      setCommissionData(json.error ? null : json)
    } catch {
      setCommissionData(null)
    } finally {
      setCommissionLoading(false)
    }
  }, [])

  useEffect(() => {
    setGhlLoading(true)
    fetchData().finally(() => setGhlLoading(false))
    const interval = setInterval(() => {
      setGhlLoading(true)
      fetchData().finally(() => setGhlLoading(false))
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData, period])

  useEffect(() => {
    fetchMarketingData()
    const interval = setInterval(fetchMarketingData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchMarketingData])

  useEffect(() => {
    fetchCommission()
    const interval = setInterval(fetchCommission, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchCommission])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading sales data…</p>
        </div>
      </div>
    )
  }

  const team = data?.team
  const reps = data?.reps || {}
  const targets = team?.targets

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {data?.updatedAt ? `Updated ${formatUpdated(data.updatedAt)}` : 'Loading…'}
          </p>
          {data?.snapshot?.asOf && (
            <p className="text-xs text-gray-600 mt-1">Data as of {new Date(data.snapshot.asOf).toLocaleString()} · {data.snapshot.source}</p>
          )}
        </div>
        <button
          onClick={() => { fetchData(); fetchMarketingData(); fetchCommission() }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors border border-gray-700"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {VIEW_LABELS.map((label, i) => (
          <button
            key={label}
            onClick={() => setViewIdx(i)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewIdx === i
                ? 'brand-active text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <section>
        <div className="flex items-center justify-between mb-3 gap-4">
          <div>
            <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest">
              Marketing &amp; Leads
            </h2>
            <p className="text-gray-600 text-xs mt-1">GHL lead flow + 30-day closed-won deal size</p>
          </div>
        </div>

        {marketingError ? (
          <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
            ⚠️ Unable to load marketing KPIs: {marketingError}
          </div>
        ) : marketingLoading && !leadsData && !dealSizeData ? (
          <div className="rounded-xl border border-gray-800 px-5 py-8 flex items-center justify-center gap-3" style={{ backgroundColor: '#111111' }}>
            <div className="w-5 h-5 border-2 border-[#AE2BCF] border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 text-sm">Loading marketing and leads data…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MarketingMetricCard title="New Leads Today" value={leadsData?.newLeads?.today ?? '—'} subtitle="Contacts added today" />
            <MarketingMetricCard title="New Leads This Week" value={leadsData?.newLeads?.week ?? '—'} subtitle="Contacts added in last 7 days" accent="#732FBA" />
            <MarketingMetricCard title="New Leads This Month" value={leadsData?.newLeads?.month ?? '—'} subtitle="Contacts added in last 30 days" accent="#731494" />
            <MarketingMetricCard title="Qualified Leads (SQL) Today" value={leadsData?.qualifiedLeads?.today ?? '—'} subtitle="Qualified opps created today" accent="#C19C46" />
            <MarketingMetricCard title="Qualified Leads Week" value={leadsData?.qualifiedLeads?.week ?? '—'} subtitle="Qualified opps created in last 7 days" />
            <MarketingMetricCard title="Average Deal Size" value={formatCurrency(dealSizeData?.avgDealSize)} subtitle="Closed won average · last 30 days" accent="#732FBA" />
            <MarketingMetricCard title="Total Deals (last 30d)" value={dealSizeData?.totalDeals ?? '—'} subtitle="Closed won deals counted" accent="#731494" />
          </div>
        )}
      </section>

      <section>
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Team — Jesse + Briana
        </h2>

        <div className="mb-4">
          {(() => {
            const actual = team?.metrics?.['Agreements Closed']?.[period] ?? 0
            const target = getTarget(targets, 'Agreements Closed', period)
            return target !== null ? (
              <KpiCard
                title="Agreements Closed"
                actual={actual}
                target={target}
                isRate={false}
                size="large"
              />
            ) : null
          })()}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {PRIMARY_METRICS.filter(m => m.key !== 'Agreements Closed').map(({ key, isRate }) => {
            const actual = team?.metrics?.[key]?.[period] ?? 0
            const target = getTarget(targets, key, period)
            if (target === null) return null
            return (
              <KpiCard
                key={key}
                title={key}
                actual={actual}
                target={target}
                isRate={isRate}
                lowerIsBetter={LOWER_IS_BETTER.has(key)}
              />
            )
          })}
        </div>
      </section>

      <CommissionTierTracker data={commissionData} loading={commissionLoading} />

      <section>
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Individual Reps
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {['Jesse', 'Briana'].map(rep => (
            <RepCard
              key={rep}
              repName={rep}
              repData={reps[rep]}
              period={period}
              metrics={PRIMARY_METRICS}
              targets={targets}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Outbound Activity
        </h2>
        <PiaCard repData={reps['Pia']} period={period} />
      </section>

      <section>
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">
          Deals Won
        </h2>
        <p className="text-gray-600 text-xs mb-3">
          Closed Won · {ghlData?.period ?? VIEW_LABELS[viewIdx]} · from GHL
        </p>
        {ghlLoading ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-8 flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 text-sm">Loading deals{period === 'year' ? ' (this may take a moment for full year data)' : '…'}</span>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #2a1a3e' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-gray-500 text-xs uppercase tracking-wider">Advisor</th>
                    <th className="text-right px-4 py-3 text-gray-500 text-xs uppercase tracking-wider">Deals Closed</th>
                    <th className="text-right px-4 py-3 text-gray-500 text-xs uppercase tracking-wider">Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const knownGAs = data?.growthAdvisors || ['Sebastian', 'Stefen', 'JC', 'Zu']
                    const byRep = ghlData?.byRep || {}
                    const unknownGHLReps = Object.keys(byRep).filter(r => !knownGAs.includes(r))
                    const allReps = [...knownGAs, ...unknownGHLReps]

                    let totalDeals = 0
                    let totalValue = 0

                    const rows = allReps.map(rep => {
                      const ghlRep = byRep[rep]
                      const deals = ghlRep?.deals ?? 0
                      const value = ghlRep?.value ?? 0
                      totalDeals += deals
                      totalValue += value
                      return (
                        <tr key={rep} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40">
                          <td className="px-4 py-3 text-white font-medium">{rep}</td>
                          <td className="text-right px-4 py-3 text-white font-semibold">
                            {ghlData ? deals : '—'}
                          </td>
                          <td className="text-right px-4 py-3 text-green-400 font-semibold">
                            {ghlData ? formatCurrency(value) : '—'}
                          </td>
                        </tr>
                      )
                    })

                    return (
                      <>
                        {rows}
                        {ghlData && (
                          <tr className="bg-gray-800/60">
                            <td className="px-4 py-3 text-gray-400 font-semibold text-xs uppercase tracking-wider">Total</td>
                            <td className="text-right px-4 py-3 text-white font-bold">{totalDeals}</td>
                            <td className="text-right px-4 py-3 text-green-300 font-bold">{formatCurrency(totalValue)}</td>
                          </tr>
                        )}
                      </>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
