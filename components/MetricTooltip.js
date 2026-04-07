/**
 * MetricTooltip — small ⓘ icon that shows a definition tooltip on hover.
 * Pure CSS hover, no JS state. Dark background, white text.
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
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          backgroundColor: '#3a2a5a',
          color: '#b084e8',
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
          bottom: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#0f0f0f',
          border: '1px solid #2a1a3e',
          color: '#e5e7eb',
          fontSize: '11px',
          lineHeight: '1.5',
          padding: '8px 10px',
          borderRadius: '8px',
          width: '240px',
          zIndex: 50,
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
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
          background-color: #5a3a8a !important;
          color: #d4a8ff !important;
        }
      `}</style>
    </span>
  )
}
