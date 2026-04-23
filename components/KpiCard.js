export default function KpiCard({
  title,
  actual,
  target,
  isRate = false,
  lowerIsBetter = false,
  size = 'normal',
}) {
  const pct = target > 0 ? (actual / target) * 100 : 0
  const effectivePct = lowerIsBetter
    ? target > 0 ? (target / Math.max(actual, 0.01)) * 100 : 100
    : pct

  const color =
    effectivePct >= 100 ? 'text-emerald-300'
    : effectivePct >= 75 ? 'text-amber-300'
    : 'text-rose-300'

  const barColor =
    effectivePct >= 100 ? 'bg-emerald-400'
    : effectivePct >= 75 ? 'bg-amber-400'
    : 'bg-rose-400'

  const displayActual = isRate
    ? `${(actual * 100).toFixed(1)}%`
    : Number.isInteger(actual) ? String(actual) : actual.toFixed(1)

  const displayTarget = isRate
    ? `${(target * 100).toFixed(0)}%`
    : String(target)

  const valueSize = size === 'large' ? 'text-4xl' : 'text-[1.75rem]'

  return (
    <div className="surface-card rounded-2xl p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] executive-muted">{title}</p>
      <div className="mb-3 flex items-end justify-between gap-3">
        <span className={`metric-card-value ${valueSize} font-semibold ${color}`}>{displayActual}</span>
        <span className="text-sm executive-muted">/ {displayTarget}</span>
      </div>
      <div className="surface-inset h-1.5 w-full overflow-hidden rounded-full border-0 shadow-none">
        <div
          className={`h-1.5 rounded-full ${barColor} transition-all`}
          style={{ width: `${Math.min(effectivePct, 100)}%` }}
        />
      </div>
      <p className={`mt-2 text-xs ${color}`}>{pct.toFixed(0)}% to target</p>
    </div>
  )
}
