/**
 * MetricTooltip — small ⓘ icon that shows a definition tooltip on hover.
 * Pure CSS hover, no JS state.
 * Usage: <MetricTooltip text="What this metric means and how it's calculated." />
 */
export default function MetricTooltip({ text }) {
  if (!text) return null

  return (
    <span className="metric-tooltip-wrapper" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '5px', verticalAlign: 'middle' }}>
      <span
        className="metric-tooltip-icon"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '15px',
          height: '15px',
          borderRadius: '999px',
          backgroundColor: 'rgba(127, 75, 171, 0.14)',
          border: '1px solid rgba(127, 75, 171, 0.28)',
          color: 'var(--brand-primary-4)',
          fontSize: '9px',
          fontWeight: '700',
          cursor: 'default',
          lineHeight: 1,
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        i
      </span>
      <span
        className="metric-tooltip-box"
        style={{
          visibility: 'hidden',
          opacity: 0,
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0)), var(--brand-bg-card)',
          border: '1px solid var(--brand-border-strong)',
          color: 'var(--brand-text-soft)',
          fontSize: '11px',
          lineHeight: '1.55',
          padding: '9px 11px',
          borderRadius: '10px',
          width: '248px',
          zIndex: 50,
          boxShadow: '0 18px 40px rgba(0,0,0,0.4)',
          transition: 'opacity 0.15s ease, visibility 0.15s ease',
          pointerEvents: 'none',
          whiteSpace: 'normal',
          textAlign: 'left',
        }}
      >
        {text}
      </span>
      <style>{`
        .metric-tooltip-wrapper:hover .metric-tooltip-box {
          visibility: visible !important;
          opacity: 1 !important;
        }
        .metric-tooltip-wrapper:hover .metric-tooltip-icon {
          background-color: rgba(127, 75, 171, 0.22) !important;
          border-color: rgba(166, 111, 205, 0.32) !important;
          color: #f3f6fb !important;
        }
      `}</style>
    </span>
  )
}
