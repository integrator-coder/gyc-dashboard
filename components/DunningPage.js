'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import MetricTooltip from '@/components/MetricTooltip'

const fmt$ = (n) => '$' + Math.round(n ?? 0).toLocaleString()
const fmtK = (n) => (n >= 1000 ? '$' + (n / 1000).toFixed(0) + 'K' : '$' + Math.round(n))
const fmtPct = (n) => (n != null ? Math.round(n * 100) + '%' : '—')

const RED   = '#EF4444'
const AMBER = '#F59E0B'

function KpiCard({ label, value, sub, danger, tooltip }) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        danger ? 'bg-red-950/40 border-red-800/60' : 'bg-gray-900 border-gray-800'
      }`}
    >
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1 flex items-center">
        {label}
        {tooltip && <MetricTooltip text={tooltip} />}
      </p>
      <p className={`text-2xl font-bold ${danger ? 'text-red-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function bucketColor(label) {
  if (label === '0–7 days' || label === '8–14 days') return AMBER
  return RED
}

/** Badge showing how many times this client has been past-due before */
function HistoryBadge({ ph }) {
  if (!ph) return null
  if (!ph.hasHistory) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-950/50 border border-green-800/40 text-green-400 font-medium">
        🟢 First time
      </span>
    )
  }
  if (ph.inCollections) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-950/60 border border-red-700/60 text-red-300 font-bold">
        ☠️ Collections
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-950/50 border border-red-800/40 text-red-400 font-medium">
      🔴 Prior history
    </span>
  )
}

/** Catch-up rate pill */
function CatchUpPill({ rate }) {
  if (rate == null) return null
  const pct = Math.round(rate * 100)
  const color = pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400'
  return (
    <span className={`text-xs font-medium ${color}`}>
      {pct}% paid back historically
    </span>
  )
}

/** Reason code tag */
function ReasonTag({ reason }) {
  if (!reason) return null
  return (
    <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300">
      {reason}
    </span>
  )
}

// ── Collections section components ───────────────────────────────────────────

function CollectionStatusBadge({ row }) {
  if (row.inCollections) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-950/60 border border-red-700/60 text-red-300 font-bold">
        ☠️ Collections
      </span>
    )
  }
  if (row.balanceRemaining > 5000) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-950/60 border border-orange-700/50 text-orange-300 font-semibold">
        ⚠️ High Value
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-950/50 border border-yellow-700/40 text-yellow-300 font-medium">
      Overdue
    </span>
  )
}

function RowAccentClass(row) {
  if (row.inCollections) return 'border-l-2 border-l-red-600'
  if (row.balanceRemaining > 5000) return 'border-l-2 border-l-orange-500'
  return 'border-l-2 border-l-yellow-600'
}

/** Shared row table for both overdue/collections rows */
function BalanceTable({ rows, editingId, setEditingId, payAmount, setPayAmount,
  payDate, setPayDate, payNote, setPayNote, submitting, handleSubmitPayment,
  submitMsg, isCollections }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className={`text-xs uppercase border-b ${
            isCollections ? 'text-red-400/70 border-red-900/60' : 'text-gray-400 border-gray-800'
          }`}>
            <th className="text-left pb-2 pr-3">Client Name</th>
            <th className="text-right pb-2 pr-3">Amount Due</th>
            <th className="text-right pb-2 pr-3">Recovered</th>
            <th className="text-right pb-2 pr-3">Balance Remaining</th>
            <th className="text-left pb-2 pr-3">Reasons</th>
            <th className="text-right pb-2 pr-3">Last Updated</th>
            <th className="text-right pb-2">Action</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${ isCollections ? 'divide-red-900/40' : 'divide-gray-800' }`}>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-6 text-center text-gray-500 text-sm">No records</td>
            </tr>
          ) : rows.map((row) => (
            <>
              <tr key={row.id} className={`align-top ${
                isCollections
                  ? 'hover:bg-red-950/20 border-l-2 border-l-red-600'
                  : `hover:bg-gray-800/40 ${RowAccentClass(row)}`
              }`}>
                {/* Client */}
                <td className="py-3 pr-3">
                  <p className={`font-medium leading-tight ${ isCollections ? 'text-red-200' : 'text-white' }`}>
                    {row.clientName}
                  </p>
                  {row.companyAcronym && (
                    <p className="text-gray-600 text-xs mt-0.5 font-mono">{row.companyAcronym}</p>
                  )}
                  {row.notes && (
                    <p className="text-gray-500 text-xs mt-1 max-w-xs truncate" title={row.notes}>
                      {row.notes.split('\n').pop()}
                    </p>
                  )}
                </td>

                {/* Amount Due */}
                <td className={`py-3 pr-3 text-right ${ isCollections ? 'text-red-300/80' : 'text-gray-300' }`}>
                  {fmt$(row.totalAmountDue)}
                </td>

                {/* Recovered */}
                <td className="py-3 pr-3 text-right text-green-400">{fmt$(row.totalCatchUpAmount)}</td>

                {/* Balance Remaining */}
                <td className="py-3 pr-3 text-right">
                  <span className={`font-bold ${
                    isCollections ? 'text-red-400'
                    : row.balanceRemaining > 5000 ? 'text-orange-400'
                    : 'text-yellow-400'
                  }`}>
                    {fmt$(row.balanceRemaining)}
                  </span>
                </td>

                {/* Reasons */}
                <td className="py-3 pr-3">
                  <div className="flex flex-wrap gap-1">
                    {(row.reasons || []).slice(0, 2).map((r, i) => (
                      <ReasonTag key={i} reason={r} />
                    ))}
                    {row.reasons?.length > 2 && (
                      <span className="text-gray-600 text-xs">+{row.reasons.length - 2}</span>
                    )}
                  </div>
                </td>

                {/* Last Updated */}
                <td className="py-3 pr-3 text-right text-gray-500 text-xs">
                  {row.updatedAt
                    ? new Date(row.updatedAt).toLocaleDateString()
                    : row.firstDueDate || '—'}
                  {row.lastPaymentDate && (
                    <p className="text-green-600 text-xs">Pmt: {row.lastPaymentDate}</p>
                  )}
                </td>

                {/* Action */}
                <td className="py-3 text-right">
                  {editingId === row.id ? (
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-gray-400 hover:text-gray-200"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditingId(row.id)}
                      className="text-xs px-2 py-1 rounded bg-blue-900/50 border border-blue-700/50 text-blue-300 hover:bg-blue-800/60"
                    >
                      Update Recovery
                    </button>
                  )}
                </td>
              </tr>

              {/* Inline payment form */}
              {editingId === row.id && (
                <tr key={`${row.id}-edit`} className="bg-gray-800/30">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="text-gray-400 text-xs block mb-1">Payment Amount ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="e.g. 500"
                          value={payAmount}
                          onChange={e => setPayAmount(e.target.value)}
                          className="bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-white text-sm w-32 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 text-xs block mb-1">Payment Date</label>
                        <input
                          type="date"
                          value={payDate}
                          onChange={e => setPayDate(e.target.value)}
                          className="bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="flex-1 min-w-40">
                        <label className="text-gray-400 text-xs block mb-1">Note (optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Partial payment via wire"
                          value={payNote}
                          onChange={e => setPayNote(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <button
                        onClick={() => handleSubmitPayment(row.id)}
                        disabled={submitting || !payAmount}
                        className="px-4 py-1.5 rounded bg-green-800/60 border border-green-600/50 text-green-300 text-sm font-semibold hover:bg-green-700/70 disabled:opacity-50"
                      >
                        {submitting ? 'Saving…' : 'Record Payment'}
                      </button>
                    </div>
                    {submitMsg && (
                      <p className="text-xs mt-2 text-gray-300">{submitMsg}</p>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CollectionsSection() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate]     = useState(new Date().toISOString().slice(0, 10))
  const [payNote, setPayNote]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg]   = useState(null)

  const load = () => {
    setLoading(true)
    fetch('/api/metrics/dunning/collections')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const handleSubmitPayment = async (id) => {
    if (!payAmount || isNaN(parseFloat(payAmount))) return
    setSubmitting(true)
    setSubmitMsg(null)
    try {
      const r = await fetch('/api/metrics/dunning/collections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, paymentAmount: parseFloat(payAmount), paymentDate: payDate, note: payNote }),
      })
      const result = await r.json()
      if (result.success) {
        setSubmitMsg('✅ Payment recorded')
        setEditingId(null)
        setPayAmount('')
        setPayNote('')
        load()
      } else {
        setSubmitMsg('❌ ' + (result.error || 'Error saving'))
      }
    } catch (e) {
      setSubmitMsg('❌ ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-400">
      Loading collections data…
    </div>
  )
  if (error || data?.error) return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-red-400">
      Collections error: {error || data?.error}
    </div>
  )

  const { overdue, activeCollections, summary } = data

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="border-t border-gray-800 pt-6">
        <h2 className="text-xl font-bold text-white">Historical Overdue &amp; Collections</h2>
        <p className="text-gray-400 text-sm mt-1">
          Clients tracked outside Stripe — cancelled subscriptions with outstanding balances
        </p>
      </div>

      {/* Summary cards — 3 buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Historical Overdue Balance"
          value={fmt$(summary.overdueBalance)}
          sub={`${summary.overdueCount} client${summary.overdueCount !== 1 ? 's' : ''} · not in active collections`}
          danger={summary.overdueBalance > 0}
        />
        <KpiCard
          label="Active Collections Balance"
          value={fmt$(summary.collectionsBalance)}
          sub={summary.collectionsCount > 0
            ? `${summary.collectionsCount} account${summary.collectionsCount !== 1 ? 's' : ''} in collections process`
            : 'No active collections'}
          danger={summary.collectionsCount > 0}
        />
        <KpiCard
          label="Overall Recovery Rate"
          value={fmtPct(summary.recoveryRate)}
          sub={`${fmt$(summary.totalRecovered)} recovered of ${fmt$(summary.totalDue)} total due`}
          danger={false}
        />
      </div>

      {/* Table 1: Historical Overdue */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="mb-4">
          <h3 className="text-white font-semibold">Historical Overdue</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            Clients with outstanding balances not in collections · {overdue.length} record{overdue.length !== 1 ? 's' : ''} · Sorted by balance remaining
          </p>
        </div>
        <BalanceTable
          rows={overdue}
          editingId={editingId}
          setEditingId={(id) => { setEditingId(id); setSubmitMsg(null) }}
          payAmount={payAmount} setPayAmount={setPayAmount}
          payDate={payDate} setPayDate={setPayDate}
          payNote={payNote} setPayNote={setPayNote}
          submitting={submitting}
          handleSubmitPayment={handleSubmitPayment}
          submitMsg={submitMsg}
          isCollections={false}
        />
      </div>

      {/* Table 2: Active Collections */}
      <div className="bg-red-950/20 border border-red-900/60 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-red-300 font-bold text-lg flex items-center gap-2">
              ☠️ Active Collections
            </h3>
            <p className="text-red-400/70 text-xs mt-0.5">
              Accounts in collections process · {activeCollections.length} record{activeCollections.length !== 1 ? 's' : ''} · Requires escalated action
            </p>
          </div>
          {activeCollections.length > 0 && (
            <div className="text-right">
              <p className="text-red-300 font-bold text-xl">{fmt$(summary.collectionsBalance)}</p>
              <p className="text-red-400/60 text-xs">total in collections</p>
            </div>
          )}
        </div>
        {activeCollections.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-green-400 font-medium">No accounts in active collections</p>
          </div>
        ) : (
          <BalanceTable
            rows={activeCollections}
            editingId={editingId}
            setEditingId={(id) => { setEditingId(id); setSubmitMsg(null) }}
            payAmount={payAmount} setPayAmount={setPayAmount}
            payDate={payDate} setPayDate={setPayDate}
            payNote={payNote} setPayNote={setPayNote}
            submitting={submitting}
            handleSubmitPayment={handleSubmitPayment}
            submitMsg={submitMsg}
            isCollections={true}
          />
        )}
      </div>
    </div>
  )
}

export default function DunningPage() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    fetch('/api/metrics/dunning')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading)
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading dunning data…</div>
  if (error || data?.error)
    return <div className="text-red-400 p-6">Error: {error || data.error}</div>

  const { summary, buckets, pastDue, updatedAt } = data
  const { pastDueCount, mrrAtRisk, totalOutstanding, avgAttempts,
          repeatOffenders, avgCatchUpRate, topReason } = summary

  const chartData = buckets.map(b => ({
    label: b.label, count: b.count, mrr: Math.round(b.mrr),
    color: bucketColor(b.label),
  }))

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Failed Payments &amp; Dunning</h1>
        <p className="text-gray-400 text-sm mt-1">
          Past-due subscriptions · Outstanding invoices · Stripe retry status ·{' '}
          Updated {new Date(updatedAt).toLocaleTimeString()}
        </p>
      </div>

      {/* KPI Cards — row 1: live Stripe */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Past-Due Subscriptions"
          value={pastDueCount}
          sub={pastDueCount > 0 ? 'Needs immediate attention' : 'All clear ✓'}
          danger={pastDueCount > 0}
        />
        <KpiCard
          label="MRR at Risk"
          value={fmt$(mrrAtRisk)}
          sub="From past-due subs"
          danger={mrrAtRisk > 0}
        />
        <KpiCard
          label="Total Outstanding"
          value={fmt$(totalOutstanding)}
          sub="Unpaid open invoices"
          danger={totalOutstanding > 0}
        />
        <KpiCard
          label="Avg Payment Attempts"
          value={avgAttempts.toFixed(1)}
          sub="Before invoice failure"
          danger={false}
        />
      </div>

      {/* KPI Cards — row 2: historical intelligence */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Repeat Offenders"
          value={repeatOffenders ?? 0}
          sub={
            repeatOffenders > 0
              ? `${repeatOffenders} current past-due have been overdue before`
              : 'No repeat history found'
          }
          danger={repeatOffenders > 0}
          tooltip="Count of currently past-due clients who also appear in the Overdue Payment Tracker 2025 sheet — meaning they have at least one prior overdue episode on record."
        />
        <KpiCard
          label="Historical Catch-Up Rate"
          value={avgCatchUpRate != null ? fmtPct(avgCatchUpRate) : '—'}
          sub="Avg % of overdue balances eventually paid back"
          danger={false}
          tooltip="Across all tracked overdue episodes (excluding collections), what percentage of the overdue amount was eventually paid back. Helps Lex gauge recovery confidence on current past-due accounts."
        />
        <KpiCard
          label="Top Failure Reason"
          value={topReason ?? '—'}
          sub="Most common reason code in tracker"
          danger={false}
          tooltip="The most frequently cited reason code across all entries in the Overdue Payment Tracker 2025 sheet."
        />
      </div>

      {/* Buckets Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-1">Days Past Due — Breakdown</h2>
        <p className="text-gray-500 text-xs mb-4">
          Amber = earlier buckets (0–14 days) · Red = older (15+ days, higher risk)
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Count chart */}
          <div>
            <p className="text-gray-400 text-xs mb-2 font-medium uppercase tracking-wide">
              Subscriptions by age bucket
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} width={32} />
                <Tooltip content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
                      <p className="text-white font-semibold mb-1">{label}</p>
                      <p style={{ color: payload[0].payload.color }}>
                        {payload[0].value} subscription{payload[0].value !== 1 ? 's' : ''}
                      </p>
                    </div>
                  ) : null
                } />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* MRR chart */}
          <div>
            <p className="text-gray-400 text-xs mb-2 font-medium uppercase tracking-wide">
              MRR at risk by age bucket
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <YAxis tickFormatter={fmtK} tick={{ fill: '#9CA3AF', fontSize: 11 }} width={48} />
                <Tooltip content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
                      <p className="text-white font-semibold mb-1">{label}</p>
                      <p style={{ color: payload[0].payload.color }}>
                        {fmt$(payload[0].value)} MRR at risk
                      </p>
                    </div>
                  ) : null
                } />
                <Bar dataKey="mrr" radius={[4, 4, 0, 0]}>
                  {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bucket pills */}
        <div className="flex flex-wrap gap-3 mt-4">
          {buckets.map(b => (
            <div
              key={b.label}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                bucketColor(b.label) === AMBER
                  ? 'bg-amber-950/40 border-amber-800/50 text-amber-300'
                  : 'bg-red-950/40 border-red-800/50 text-red-300'
              }`}
            >
              <span>{b.label}</span>
              <span className="text-gray-400">·</span>
              <span>{b.count} subs</span>
              <span className="text-gray-400">·</span>
              <span>{fmt$(b.mrr)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Past-Due Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold">Past-Due Subscriptions</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              Sorted by days past due — oldest first · History from Overdue Payment Tracker 2025
            </p>
          </div>
          {pastDueCount > 0 && (
            <span className="text-red-400 text-xs font-semibold px-3 py-1 bg-red-950/50 border border-red-800/50 rounded-full">
              {pastDueCount} past due
            </span>
          )}
        </div>

        {pastDue.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-2xl mb-2">✅</p>
            <p className="font-medium text-gray-400">No past-due subscriptions</p>
            <p className="text-xs mt-1">All subscriptions are current</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-gray-400 text-xs uppercase border-b border-gray-800">
                  <th className="text-left pb-2 pr-3">Client</th>
                  <th className="text-left pb-2 pr-3">GA</th>
                  <th className="text-left pb-2 pr-3">CRM</th>
                  <th className="text-left pb-2 pr-3">History</th>
                  <th className="text-right pb-2 pr-3">MRR</th>
                  <th className="text-right pb-2 pr-3">Days Past Due</th>
                  <th className="text-right pb-2 pr-3">Outstanding</th>
                  <th className="text-right pb-2 pr-3">Attempts</th>
                  <th className="text-right pb-2">Next Retry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {pastDue.map((row, i) => {
                  const isOld = row.daysPastDue >= 14
                  const ph    = row.paymentHistory

                  return (
                    <tr key={i} className="hover:bg-gray-800/50 align-top">
                      {/* Client name */}
                      <td className="py-3 pr-3">
                        <p className="text-white font-medium leading-tight">{row.name}</p>
                        {row.email && (
                          <p className="text-gray-500 text-xs mt-0.5">{row.email}</p>
                        )}
                        {row.acronym && (
                          <p className="text-gray-600 text-xs mt-0.5 font-mono">{row.acronym}</p>
                        )}
                      </td>

                      {/* Assigned GA */}
                      <td className="py-3 pr-3">
                        {row.assignedGA ? (
                          <span className="text-blue-300 text-xs font-medium">
                            {row.assignedGA}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>

                      {/* CRM type */}
                      <td className="py-3 pr-3">
                        {row.crmType ? (
                          <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-purple-950/50 border border-purple-800/40 text-purple-300">
                            {row.crmType}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Payment history column */}
                      <td className="py-3 pr-3">
                        <div className="space-y-1">
                          <HistoryBadge ph={ph} />
                          {ph?.hasHistory && (
                            <>
                              <CatchUpPill rate={ph.catchUpRate} />
                              {ph.lastReason && (
                                <div>
                                  <ReasonTag reason={ph.lastReason} />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* MRR */}
                      <td className="py-3 pr-3 text-right text-white">{fmt$(row.mrr)}</td>

                      {/* Days past due */}
                      <td className="py-3 pr-3 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                            isOld
                              ? 'bg-red-950 text-red-400 border border-red-800/50'
                              : 'bg-amber-950 text-amber-400 border border-amber-800/50'
                          }`}
                        >
                          {row.daysPastDue}d
                        </span>
                      </td>

                      {/* Outstanding */}
                      <td className="py-3 pr-3 text-right text-red-400 font-medium">
                        {fmt$(row.amountDue)}
                      </td>

                      {/* Attempts */}
                      <td className="py-3 pr-3 text-right text-gray-300">{row.attemptCount}×</td>

                      {/* Next retry */}
                      <td className="py-3 text-right text-gray-400 text-xs">
                        {row.nextAttempt ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History legend */}
      {summary.historyLoaded > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
            Payment History Legend
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-gray-400">
            <span>🟢 <strong className="text-gray-300">First time</strong> — no prior overdue episode on record</span>
            <span>🔴 <strong className="text-gray-300">Prior history</strong> — appeared in Overdue Tracker before</span>
            <span>☠️ <strong className="text-gray-300">Collections</strong> — sent to collections / attorneys</span>
            <span className="text-gray-500 ml-auto">{summary.historyLoaded} episodes loaded from tracker</span>
          </div>
        </div>
      )}

      {/* Collections & Historical Overdue section */}
      <CollectionsSection />

      {/* Footer */}
      <p className="text-gray-600 text-xs pb-4">
        Data: Stripe (live) · Overdue Payment Tracker 2025 (Google Sheets) · Active Client List (Google Sheets)
      </p>
    </div>
  )
}
