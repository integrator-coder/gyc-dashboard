import MetricTooltip from '@/components/MetricTooltip'

/**
 * Reusable metric card for the KPI dashboard.
 * Shows a title, value, optional subtitle, optional trend indicator, optional icon, and optional tooltip.
 */
export default function MetricCard({ title, value, subtitle, trend, trendPositive, icon, tooltip }) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <div className="flex justify-between items-start mb-2">
        <span className="text-gray-400 text-sm font-medium flex items-center">
          {title}
          {tooltip && <MetricTooltip text={tooltip} />}
        </span>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      {subtitle && <div className="text-gray-300 text-xs">{subtitle}</div>}
      {trend && (
        <div className={`text-sm mt-2 font-medium ${trendPositive ? 'text-green-400' : 'text-red-400'}`}>
          {trendPositive ? '↑' : '↓'} {trend}
        </div>
      )}
    </div>
  )
}
