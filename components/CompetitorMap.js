'use client'
import dynamic from 'next/dynamic'

// Dynamic import with ssr:false prevents "window is not defined" errors
// Leaflet requires browser APIs (window, document) that don't exist in Node.js SSR
const CompetitorMapInner = dynamic(() => import('./CompetitorMapInner'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '360px',
      background: 'rgba(10,5,20,0.6)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#6b7280',
      fontSize: 13,
    }}>
      🗺️ Loading map…
    </div>
  ),
})

export default function CompetitorMap(props) {
  return <CompetitorMapInner {...props} />
}
