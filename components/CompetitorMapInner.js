'use client'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

// This component is only loaded client-side (via dynamic import with ssr:false)
// It requires leaflet which needs the browser's window object

export default function CompetitorMapInner({ clientLocation, competitors = [], radiusMiles = 5, height = '360px' }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current) return
    if (mapInstanceRef.current) return // already initialized

    // Dynamically import leaflet (runtime only) — CSS already imported above
    import('leaflet').then(L => {

      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      })

      mapInstanceRef.current = map

      // CartoDB Voyager — bright, high-contrast, readable over dark dashboard
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      // Custom icons
      const clientIcon = L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;border-radius:50%;background:#731494;border:3px solid #fff;box-shadow:0 0 0 2px #AE2BCF, 0 2px 8px rgba(0,0,0,0.5)"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10],
      })

      const competitorIcon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        popupAnchor: [0, -8],
      })

      const bounds = []

      // Client location marker
      if (clientLocation?.lat != null && clientLocation?.lng != null) {
        const clientMarker = L.marker([clientLocation.lat, clientLocation.lng], { icon: clientIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;min-width:160px">
              <div style="font-weight:700;font-size:13px;margin-bottom:4px">🏢 ${clientLocation.name || 'Client Location'}</div>
              ${clientLocation.address ? `<div style="font-size:11px;color:#555">${clientLocation.address}</div>` : ''}
            </div>
          `)

        bounds.push([clientLocation.lat, clientLocation.lng])

        // 5-mile radius circle (5 miles ≈ 8047 meters)
        const radiusMeters = radiusMiles * 1609.34
        L.circle([clientLocation.lat, clientLocation.lng], {
          radius: radiusMeters,
          color: '#731494',
          weight: 1.5,
          dashArray: '6 4',
          fillColor: '#731494',
          fillOpacity: 0.04,
        }).addTo(map)
      }

      // Competitor markers
      competitors.forEach(comp => {
        const lat = comp.location?.lat ?? comp.lat
        const lng = comp.location?.lng ?? comp.lng
        if (lat == null || lng == null) return

        bounds.push([lat, lng])

        // Build status string
        let statusStr = ''
        if (comp.businessStatus === 'CLOSED_PERMANENTLY') statusStr = '🔴 Perm. Closed'
        else if (comp.businessStatus === 'CLOSED_TEMPORARILY') statusStr = '🟠 Temp. Closed'
        else if (comp.isOpen) statusStr = '🟢 Open Now'
        else statusStr = '⚫ Closed'

        // Build hours summary
        let hoursStr = ''
        if (comp.hours) {
          const entries = Object.entries(comp.hours).slice(0, 2)
          hoursStr = entries.map(([d, h]) => `${d}: ${h}`).join('<br>')
          if (Object.keys(comp.hours).length > 2) hoursStr += `<br>+${Object.keys(comp.hours).length - 2} more`
        }

        const popupContent = `
          <div style="font-family:sans-serif;min-width:200px;max-width:260px">
            <div style="font-weight:700;font-size:13px;margin-bottom:5px">${comp.name}</div>
            ${comp.rating ? `<div style="font-size:12px;color:#c97a00;margin-bottom:3px">⭐ ${comp.rating} <span style="color:#777">(${(comp.reviewCount || 0).toLocaleString()} reviews)</span></div>` : '<div style="font-size:12px;color:#999;margin-bottom:3px">⭐ No rating</div>'}
            ${comp.distanceMiles != null ? `<div style="font-size:11px;color:#555;margin-bottom:3px">📍 ${comp.distanceMiles} mi away</div>` : ''}
            ${comp.primaryType ? `<div style="font-size:11px;color:#7c3aed;margin-bottom:3px">📁 ${comp.primaryType}</div>` : ''}
            <div style="font-size:11px;margin-bottom:3px">${statusStr}</div>
            ${hoursStr ? `<div style="font-size:10px;color:#666;line-height:1.5">${hoursStr}</div>` : ''}
          </div>
        `

        L.marker([lat, lng], { icon: competitorIcon })
          .addTo(map)
          .bindPopup(popupContent)
      })

      // Fit map to show all pins
      if (bounds.length > 0) {
        if (bounds.length === 1) {
          map.setView(bounds[0], 13)
        } else {
          map.fitBounds(bounds, { padding: [40, 40] })
        }
      }
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '2px solid rgba(115,20,148,0.4)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
      <div ref={mapRef} style={{ height, width: '100%', borderRadius: 12 }} />
      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        right: 10,
        zIndex: 1000,
        background: 'rgba(10,5,20,0.85)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 11,
        color: '#d1d5db',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#731494', border: '2px solid #AE2BCF', flexShrink: 0 }} />
          <span>Client Location</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '2px solid #fff', flexShrink: 0 }} />
          <span>Competitor</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 2, background: '#731494', opacity: 0.7, flexShrink: 0 }} />
          <span>{radiusMiles}-mile radius</span>
        </div>
      </div>
    </div>
  )
}
