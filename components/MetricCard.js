import MetricTooltip from '@/components/MetricTooltip'

/**
 * Reusable metric card for the KPI dashboard.
 * Shows a title, value, optional subtitle, optional trend indicator, optional icon, and optional tooltip.
 */
export default function MetricCard({ title, value, subtitle, trend, trendPositive, icon, tooltip }) {
  return (
    <div className="surface-card h-full rounded-2xl p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] executive-muted">
          {title}
          {tooltip && <MetricTooltip text={tooltip} />}
        </span>
        {icon && (
          <span className="surface-subtle flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--brand-border)] text-xl text-[var(--brand-primary-4)]">
            {icon}
          </span>
        )}
      </div>
      <div className="metric-card-value mb-1 text-3xl font-semibold text-white">{value}</div>
      {subtitle && <div className="text-[13px] executive-muted">{subtitle}</div>}
      {trend && (
        <div className={`mt-3 text-sm font-medium ${trendPositive ? 'text-emerald-300' : 'text-rose-300'}`}>
          {trendPositive ? '↑' : '↓'} {trend}
        </div>
      )}
    </div>
  )
}
