'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'

const fmt$ = (n) => '$' + Math.round(n || 0).toLocaleString()
const fmtK = (n) => {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K'
  return '$' + Math.round(n)
}

const CHURN_OPTIONS = [
  { label: '0%',  value: '0',  color: '#14B8A6' },
  { label: '3%',  value: '3',  color: '#F59E0B' },
  { label: '5%',  value: '5',  color: '#F97316' },
  { label: '8%',  value: '8',  color: '#EF4444' },
]

const COLOR_ACTUAL       = '#4F46E5'   // indigo   — historical actual MRR
const COLOR_BASE         = '#1E40AF'   // dark blue — base MRR after churn
const COLOR_PRIOR        = '#7C3AED'   // purple   — prior renewals compounding
const COLOR_THIS_MONTH   = '#14B8A6'   // teal     — new renewals this month

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const first = payload[0]?.payload
  const isHistorical = first?.type === 'historical'

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm min-w-[180px]">
      <p className="text-white font-semibold mb-2">{label}</p>
      {isHistorical ? (
        <p style={{ color: COLOR_ACTUAL }}>
          Actual MRR: {fmt$(first?.actualMRR)}
        </p>
      ) : (
        <>
          {payload.map((p) => (
            <p key={p.name} style={{ color: p.fill }} className="flex justify-between gap-4">
              <span>{p.name}:</span>
              <span className="font-medium">{fmt$(p.value)}</span>
            </p>
          ))}
          <div className="border-t border-gray-600 mt-2 pt-2">
            <p className="text-white flex justify-between gap-4 font-semibold">
              <span>Total:</span>
              <span>{fmt$(payload.reduce((s, p) => s + (p.value || 0), 0))}</span>
            </p>
          </div>
        </>
      )}
    </div>
  )
}

export default function MrrGrowthProjectionChart({ mrrProjection }) {
  const [selectedChurn, setSelectedChurn] = useState('0')

  const { currentMRR = 0, historical = [], projected = [] } = mrrProjection || {}

  // Build combined chart data
  const chartData = useMemo(() => {
    const hist = historical.map(h => ({
      label: h.label,
      month: h.month,
      type: 'historical',
      actualMRR: h.mrr,
      baseMRR: 0,
      priorRenewals: 0,
      thisMonthRenewal: 0,
    }))

    const proj = projected.map(p => {
      const scenario = p.scenarios?.[selectedChurn] || {}
      return {
        label: p.label,
        month: p.month,
        type: 'projected',
        actualMRR: 0,
        baseMRR: scenario.base || 0,
        priorRenewals: scenario.priorRenewals || 0,
        thisMonthRenewal: scenario.thisMonthRenewal || 0,
      }
    })

    return [...hist, ...proj]
  }, [historical, projected, selectedChurn])

  // Find divider index (between last historical and first projected)
  const dividerLabel = projected[0]?.label

  // Summary stats for selected churn scenario
  const lastProjected = projected[projected.length - 1]?.scenarios?.[selectedChurn]
  const totalRenewalsAdded = projected.reduce((s, p) => s + (p.scenarios?.[selectedChurn]?.thisMonthRenewal || 0), 0)

  if (!mrrProjection) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p className="text-gray-400 text-sm">MRR projection data unavailable.</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-white font-semibold">MRR Growth Projection — Renewals + Churn</h2>
          <p className="text-gray-400 text-xs mt-0.5">
            Historical actual MRR · Projected base + renewal stack · Starting MRR: {fmt$(currentMRR)}
          </p>
        </div>

        {/* Churn Toggle */}
        <div className="flex flex-col items-end gap-1.5">
          <p className="text-gray-500 text-xs">Churn rate assumption</p>
          <div className="flex gap-1.5">
            {CHURN_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSelectedChurn(opt.value)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                  selectedChurn === opt.value
                    ? 'border-transparent text-gray-900'
                    : 'border-gray-700 text-gray-400 bg-transparent hover:border-gray-500 hover:text-gray-200'
                }`}
                style={selectedChurn === opt.value ? { backgroundColor: opt.color, borderColor: opt.color } : {}}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary stat pills */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="bg-gray-800 rounded-lg px-3 py-2">
          <p className="text-gray-500 text-xs">Current MRR</p>
          <p className="text-white font-semibold text-sm">{fmt$(currentMRR)}</p>
        </div>
        {lastProjected && (
          <div className="bg-gray-800 rounded-lg px-3 py-2">
            <p className="text-gray-500 text-xs">Projected MRR (13 mo)</p>
            <p className="text-teal-400 font-semibold text-sm">{fmt$(lastProjected.total)}</p>
          </div>
        )}
        <div className="bg-gray-800 rounded-lg px-3 py-2">
          <p className="text-gray-500 text-xs">Total Renewals Pipeline</p>
          <p className="text-purple-400 font-semibold text-sm">{fmt$(totalRenewalsAdded)}/mo added</p>
        </div>
        {lastProjected && (
          <div className="bg-gray-800 rounded-lg px-3 py-2">
            <p className="text-gray-500 text-xs">Net Change ({selectedChurn}% churn)</p>
            <p className={`font-semibold text-sm ${lastProjected.total >= currentMRR ? 'text-green-400' : 'text-red-400'}`}>
              {lastProjected.total >= currentMRR ? '+' : ''}{fmt$(lastProjected.total - currentMRR)}
            </p>
          </div>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barCategoryGap="15%">
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={48}
          />
          <YAxis tickFormatter={fmtK} tick={{ fill: '#9CA3AF', fontSize: 11 }} width={52} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }}
            formatter={(value) => <span style={{ color: '#9CA3AF' }}>{value}</span>}
          />

          {/* Divider between historical and projected */}
          {dividerLabel && (
            <ReferenceLine
              x={dividerLabel}
              stroke="#6B7280"
              strokeDasharray="4 2"
              strokeWidth={1.5}
              label={{ value: 'Projected →', position: 'insideTopRight', fill: '#9CA3AF', fontSize: 10 }}
            />
          )}

          {/* Historical bar — actual MRR */}
          <Bar
            dataKey="actualMRR"
            name="Actual MRR"
            stackId="mrr"
            fill={COLOR_ACTUAL}
            radius={[4, 4, 0, 0]}
            opacity={0.85}
          />

          {/* Projected stacked bars */}
          <Bar
            dataKey="baseMRR"
            name="Base MRR"
            stackId="mrr"
            fill={COLOR_BASE}
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="priorRenewals"
            name="Prior Renewals"
            stackId="mrr"
            fill={COLOR_PRIOR}
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="thisMonthRenewal"
            name="This Month's Renewals"
            stackId="mrr"
            fill={COLOR_THIS_MONTH}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend explainer */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: COLOR_ACTUAL }} />
          Actual MRR (historical)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: COLOR_BASE }} />
          Base MRR after {selectedChurn}% monthly churn
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: COLOR_PRIOR }} />
          Prior renewals (compounding, subject to churn)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: COLOR_THIS_MONTH }} />
          This month's new renewals
        </span>
      </div>
    </div>
  )
}
