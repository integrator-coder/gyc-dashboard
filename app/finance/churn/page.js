'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

function formatCurrency(value) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function reasonLabel(reason) {
  if (!reason) return null
  const map = {
    cancellation_requested: 'Cancellation requested',
    payment_failed: 'Payment failed',
    payment_disputed: 'Payment disputed',
  }
  return map[reason] || reason.replace(/_/g, ' ')
}

export default function ChurnPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/metrics/finance/churn')
      .then(res => res.json())
      .then(json => {
        if (json.error) throw new Error(json.error)
        setData(json)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading churn data…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/finance"
          className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
        >
          ← Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">
            Churn — {data?.month ?? '…'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Subscriptions canceled this calendar month
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Churned Clients</p>
          <p className="text-4xl font-bold text-red-400">{data?.count ?? '—'}</p>
          <p className="text-gray-500 text-xs mt-1">Cancellations this month</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">MRR Lost</p>
          <p className="text-4xl font-bold text-red-400">{formatCurrency(data?.totalMrrLost)}</p>
          <p className="text-gray-500 text-xs mt-1">
            ARR impact: {formatCurrency(data?.totalMrrLost ? data.totalMrrLost * 12 : null)}
          </p>
        </div>
      </div>

      {/* Churn Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">Churned Clients</h3>
        </div>

        {!data?.clients?.length ? (
          <div className="px-5 py-14 text-center">
            <p className="text-4xl mb-3">🎉</p>
            <p className="text-green-400 font-semibold text-lg">No churn this month!</p>
            <p className="text-gray-500 text-sm mt-1">Zero cancellations so far. Keep it up.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Client</th>
                  <th className="text-left px-5 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Email</th>
                  <th className="text-right px-5 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">MRR Lost</th>
                  <th className="text-right px-5 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">ARR Lost</th>
                  <th className="text-left px-5 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Canceled</th>
                  <th className="text-left px-5 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.clients.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-red-900 flex items-center justify-center text-xs text-red-300 font-bold shrink-0">
                          {(c.name || c.email || '?')[0].toUpperCase()}
                        </div>
                        <span className="text-white text-sm font-medium">
                          {c.name || <span className="text-gray-500 italic">No name</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-sm">{c.email || '—'}</td>
                    <td className="px-5 py-3 text-right text-red-400 text-sm font-medium">
                      {formatCurrency(c.mrr)}
                    </td>
                    <td className="px-5 py-3 text-right text-red-400/70 text-sm">
                      {formatCurrency(c.mrr * 12)}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-sm">{formatDate(c.canceledAt)}</td>
                    <td className="px-5 py-3 text-sm">
                      {c.cancelReason ? (
                        <div>
                          <span className="text-gray-300">{reasonLabel(c.cancelReason)}</span>
                          {c.cancelComment && (
                            <p className="text-gray-500 text-xs mt-0.5 italic">"{c.cancelComment}"</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-800/50">
                  <td className="px-5 py-3 text-gray-400 text-sm font-medium" colSpan={2}>Total</td>
                  <td className="px-5 py-3 text-right text-red-400 text-sm font-bold">
                    {formatCurrency(data.totalMrrLost)}
                  </td>
                  <td className="px-5 py-3 text-right text-red-400/70 text-sm font-bold">
                    {formatCurrency(data.totalMrrLost * 12)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
