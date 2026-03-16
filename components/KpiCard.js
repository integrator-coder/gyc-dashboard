export default function KpiCard({
  title,
  actual,
  target,
  isRate = false,
  lowerIsBetter = false,
  size = 'normal', // 'normal' | 'large'
}) {
  const pct = target > 0 ? (actual / target) * 100 : 0
  const effectivePct = lowerIsBetter
    ? target > 0 ? (target / Math.max(actual, 0.01)) * 100 : 100
    : pct

  const color =
    effectivePct >= 100 ? 'text-green-400'
    : effectivePct >= 75 ? 'text-yellow-400'
    : 'text-red-400'

  const barColor =
    effectivePct >= 100 ? 'bg-green-500'
    : effectivePct >= 75 ? 'bg-yellow-500'
    : 'bg-red-500'

  const displayActual = isRate
    ? `${(actual * 100).toFixed(1)}%`
    : Number.isInteger(actual) ? String(actual) : actual.toFixed(1)

  const displayTarget = isRate
    ? `${(target * 100).toFixed(0)}%`
    : String(target)

  const valueSize = size === 'large' ? 'text-4xl' : 'text-2xl'

  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">{title}</p>
      <div className="flex items-end justify-between mb-2">
        <span className={`${valueSize} font-bold ${color}`}>{displayActual}</span>
        <span className="text-gray-600 text-sm">/ {displayTarget}</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${barColor} transition-all`}
          style={{ width: `${Math.min(effectivePct, 100)}%` }}
        />
      </div>
      <p className={`text-xs mt-1.5 ${color}`}>{pct.toFixed(0)}% to target</p>
    </div>
  )
}
