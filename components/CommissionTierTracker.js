'use client'

const PRODUCT_LABELS = {
  website:     'Website',
  blueprint:   'Blueprint',
  seoCore:     'SEO Core',
  seoAdvanced: 'SEO Advanced',
}

const TIER_RANGES = {
  website:     [{ min: 1 }, { min: 10 }, { min: 15 }, { min: 20 }, { min: 25 }],
  blueprint:   [{ min: 1 }, { min: 10 }, { min: 15 }, { min: 20 }],
  seoCore:     [{ min: 1 }, { min: 10 }, { min: 15 }, { min: 20 }],
  seoAdvanced: [{ min: 1 }, { min: 5  }, { min: 10 }],
}

function formatCurrency(val) {
  if (!val || val <= 0) return null
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)
}

function formatPercent(rate) {
  return `${(rate * 100).toFixed(1).replace(/\.0$/, '')}%`
}

function calcProgress(count, productKey, tier) {
  const ranges = TIER_RANGES[productKey]
  if (!ranges || tier === 0 || count === 0) return 0
  const tierIdx = tier - 1
  if (tierIdx >= ranges.length - 1) return 100
  const tierMin = ranges[tierIdx].min
  const nextMin = ranges[tierIdx + 1].min
  return Math.min(100, Math.max(0, ((count - tierMin) / (nextMin - tierMin)) * 100))
}

// Team-level product card showing combined progress toward next tier
function TeamProductCard({ productKey, teamData }) {
  if (!teamData) return null
  const { count, tier, rate, nextTier, dealsToNext, nextRate, retroactiveGain } = teamData
  const label = PRODUCT_LABELS[productKey]
  const progress = calcProgress(count, productKey, tier)
  const isMaxTier = nextTier === null
  const isClose = !isMaxTier && progress >= 75
  const retroFormatted = formatCurrency(retroactiveGain)

  let barColor = 'bg-blue-500'
  if (isMaxTier) barColor = 'bg-emerald-500'
  else if (isClose) barColor = 'bg-amber-400'

  if (count === 0 && !isMaxTier) {
    return (
      <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/40">
        <div className="flex items-center justify-between mb-1">
          <span className="text-gray-300 text-sm font-medium">{label}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/40 text-gray-300 border border-gray-600/30">No sales yet</span>
        </div>
        <p className="text-gray-300 text-xs">{dealsToNext} team deals to unlock Tier 1 ({formatPercent(nextRate)})</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/60">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-300 text-sm font-medium">{label}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          isMaxTier ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
          : isClose  ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
          : 'bg-blue-900/60 text-blue-300 border border-blue-800/50'
        }`}>
          Tier {tier} — {formatPercent(rate)}
        </span>
      </div>

      <div className="flex items-end gap-1 mb-2">
        <span className="text-2xl font-bold text-white">{count}</span>
        <span className="text-gray-300 text-xs mb-1">team deal{count !== 1 ? 's' : ''}</span>
      </div>

      <div className="mb-2">
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${progress}%` }} />
        </div>
      </div>

      {isMaxTier ? (
        <p className="text-emerald-400 text-xs font-medium">🏆 Max tier — {formatPercent(rate)} on all deals</p>
      ) : (
        <p className={`text-xs font-medium ${isClose ? 'text-amber-400' : 'text-gray-300'}`}>
          {dealsToNext} more team deal{dealsToNext !== 1 ? 's' : ''} → Tier {nextTier} ({formatPercent(nextRate)})
        </p>
      )}

      {retroFormatted && !isMaxTier && (
        <div className="mt-2 flex items-center gap-1.5 bg-amber-950/40 border border-amber-700/40 rounded-md px-2.5 py-1.5 animate-pulse">
          <span className="text-amber-400 text-xs">💰</span>
          <span className="text-amber-300 text-xs font-semibold">
            Hitting Tier {nextTier} adds +{retroFormatted} to this month&apos;s commissions
          </span>
        </div>
      )}
    </div>
  )
}

// Per-rep row showing their individual contribution + est. commission
function RepRow({ repName, repData, teamData }) {
  const products = ['website', 'blueprint', 'seoCore', 'seoAdvanced']
  const bgColors   = { Jesse: 'bg-blue-900',   Briana: 'bg-purple-900' }
  const textColors = { Jesse: 'text-blue-300',  Briana: 'text-purple-300' }

  // Estimated commission = rep's totalValue × team tier rate
  let totalEst = 0
  const breakdown = products.map(key => {
    const rep  = repData?.[key]
    const team = teamData?.[key]
    const rate = team?.rate || 0
    const est  = (rep?.totalValue || 0) * rate
    totalEst += est
    return { key, count: rep?.count || 0, est, rate }
  }).filter(p => p.count > 0)

  if (breakdown.length === 0) return (
    <div className="flex items-center gap-3 px-3 py-2 bg-gray-800/30 rounded-lg border border-gray-700/30">
      <span className={`w-7 h-7 rounded-full ${bgColors[repName] || 'bg-gray-700'} flex items-center justify-center text-xs font-bold ${textColors[repName] || 'text-gray-300'}`}>
        {repName[0]}
      </span>
      <span className="text-gray-300 text-sm">{repName} — no deals yet</span>
    </div>
  )

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-800/40 rounded-lg border border-gray-700/40">
      <span className={`w-7 h-7 rounded-full ${bgColors[repName] || 'bg-gray-700'} flex items-center justify-center text-xs font-bold ${textColors[repName] || 'text-gray-300'} shrink-0`}>
        {repName[0]}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-white text-sm font-medium">{repName}</span>
          {breakdown.map(p => (
            <span key={p.key} className="text-xs px-1.5 py-0.5 rounded bg-gray-700/60 text-gray-400">
              {PRODUCT_LABELS[p.key]}: {p.count}
            </span>
          ))}
        </div>
      </div>
      {totalEst > 0 && (
        <div className="text-right shrink-0">
          <p className="text-gray-300 text-xs">Est. commission</p>
          <p className="text-emerald-400 font-bold text-sm">{formatCurrency(totalEst)}</p>
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 animate-pulse space-y-3">
      <div className="h-3 w-40 bg-gray-700 rounded" />
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-gray-800/60 rounded-lg p-3">
          <div className="flex justify-between mb-2">
            <div className="h-3 w-16 bg-gray-700 rounded" />
            <div className="h-3 w-20 bg-gray-700 rounded" />
          </div>
          <div className="h-6 w-10 bg-gray-700 rounded mb-2" />
          <div className="h-2 w-full bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  )
}

export default function CommissionTierTracker({ data, loading }) {
  const currentMonth = data?.currentMonth || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const products = ['website', 'blueprint', 'seoCore', 'seoAdvanced']

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest">
          💰 Commission Tier Progress — {currentMonth}
        </h2>
        {data?.totalDealsThisMonth !== undefined && (
          <span className="text-gray-300 text-xs">{data.totalDealsThisMonth} team deal{data.totalDealsThisMonth !== 1 ? 's' : ''} this month</span>
        )}
      </div>

      {loading ? (
        <Skeleton />
      ) : !data ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 px-5 py-8 text-center">
          <p className="text-gray-300 text-sm">Commission data unavailable</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">

          {/* Team tier progress — one card per product */}
          <div>
            <p className="text-gray-300 text-xs uppercase tracking-wider mb-2">Team Tier Progress</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {products.map(key => (
                <TeamProductCard key={key} productKey={key} teamData={data.team?.[key]} />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800" />

          {/* Per-rep breakdown */}
          <div>
            <p className="text-gray-300 text-xs uppercase tracking-wider mb-2">Rep Contributions</p>
            <div className="space-y-2">
              {['Jesse', 'Briana'].map(rep => (
                <RepRow key={rep} repName={rep} repData={data.reps?.[rep]} teamData={data.team} />
              ))}
            </div>
          </div>

        </div>
      )}
    </section>
  )
}
