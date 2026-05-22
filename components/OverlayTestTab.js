'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Circle, Tooltip, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default marker icon in Next.js
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Color mapping for SEO ranks
function getRankColor(rank) {
  if (!rank || rank === null) return '#9ca3af' // gray
  if (rank >= 1 && rank <= 3) return '#22c55e'  // green
  if (rank >= 4 && rank <= 7) return '#84cc16'  // yellow-green
  if (rank >= 8 && rank <= 10) return '#eab308' // yellow
  if (rank >= 11 && rank <= 15) return '#f97316' // orange
  if (rank >= 16 && rank <= 20) return '#ef4444' // red
  return '#9ca3af' // gray for unranked
}

function getRankOpacity(rank) {
  if (!rank || rank === null) return 0.2
  if (rank >= 1 && rank <= 3) return 0.8
  if (rank >= 4 && rank <= 7) return 0.7
  if (rank >= 8 && rank <= 10) return 0.6
  if (rank >= 11 && rank <= 15) return 0.5
  if (rank >= 16 && rank <= 20) return 0.4
  return 0.2
}

// Color mapping for median household income (purple gradient)
function getIncomeColor(income, minIncome, maxIncome) {
  if (!income || income === 0) return '#e5e7eb' // gray for missing data
  
  // Normalize income to 0-1 range
  const normalized = Math.min(Math.max((income - minIncome) / (maxIncome - minIncome), 0), 1)
  
  // Purple gradient: light purple (#e9d5ff) to deep purple (#7c3aed)
  const lightR = 233, lightG = 213, lightB = 255
  const darkR = 124, darkG = 58, darkB = 237
  
  const r = Math.round(lightR + (darkR - lightR) * normalized)
  const g = Math.round(lightG + (darkG - lightG) * normalized)
  const b = Math.round(lightB + (darkB - lightB) * normalized)
  
  return `rgb(${r}, ${g}, ${b})`
}

// Color mapping for parent origin intensity (blue gradient)
function getParentOriginColor(parentCount) {
  if (!parentCount || parentCount === 0) return '#e5e7eb' // gray
  
  // Normalize to 0-1 range (0-50 parents)
  const normalized = Math.min(parentCount / 50, 1)
  
  // Blue gradient: light blue (#dbeafe) to deep blue (#1e40af)
  const lightR = 219, lightG = 234, lightB = 254
  const darkR = 30, darkG = 64, darkB = 175
  
  const r = Math.round(lightR + (darkR - lightR) * normalized)
  const g = Math.round(lightG + (darkG - lightG) * normalized)
  const b = Math.round(lightB + (darkB - lightB) * normalized)
  
  return `rgb(${r}, ${g}, ${b})`
}

// Calculate circle radius for ZIP zones (consistent size across all layers)
function getZipCircleRadius() {
  return 800 // ~0.5 mile radius for ZIP zone representation
}

export default function OverlayTestTab({ acronym }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [layers, setLayers] = useState({
    seo: true,
    income: false,
    parentOrigin: false,
  })

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/clients/${acronym}/overlay-test`)
        if (!res.ok) throw new Error('Failed to fetch overlay data')
        const json = await res.json()
        setData(json)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [acronym])

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        <p className="mt-4 text-gray-600">Loading overlay data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Error: {error}</p>
      </div>
    )
  }

  if (!data || !data.center) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">No data available for overlay test</p>
      </div>
    )
  }

  const { seoPoints = [], incomeZips = [], parentOriginZones = [], center, locationName } = data

  // Calculate income min/max for gradient scaling
  const incomes = incomeZips.map(z => z.medianHouseholdIncome).filter(i => i > 0)
  const minIncome = incomes.length > 0 ? Math.min(...incomes) : 0
  const maxIncome = incomes.length > 0 ? Math.max(...incomes) : 100000

  return (
    <div className="h-full flex flex-col">
      {/* Header with layer toggles */}
      <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">🧪 Market Intelligence Overlay — {locationName}</h2>
          <p className="text-sm text-gray-500">Three-layer comparative analysis: Rankings × Income × Parent Origin</p>
        </div>
        
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.seo}
              onChange={(e) => setLayers({ ...layers, seo: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700">SEO Rankings</span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.income}
              onChange={(e) => setLayers({ ...layers, income: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700">Income (ZIP)</span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={layers.parentOrigin}
              onChange={(e) => setLayers({ ...layers, parentOrigin: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700">Parent Origin (theoretical)</span>
          </label>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Center marker for Eastside location */}
          <Marker position={[center.lat, center.lng]}>
            <Popup>
              <strong>{locationName}</strong>
              <br />
              <span className="text-xs text-gray-600">Location center</span>
            </Popup>
          </Marker>

          {/* Layer 1: SEO Grid (colored by rank) */}
          {layers.seo && seoPoints.map((point, idx) => (
            <Circle
              key={`seo-${idx}`}
              center={[point.lat, point.lng]}
              radius={400}
              pathOptions={{
                color: getRankColor(point.rank),
                fillColor: getRankColor(point.rank),
                fillOpacity: getRankOpacity(point.rank),
                weight: 1,
              }}
            >
              <Tooltip>
                <strong>SEO Rank: {point.rank || 'Unranked'}</strong>
                <br />
                Keyword: "{point.keyword}"
                <br />
                <span className="text-xs text-gray-600">Grid position: {point.col}, {point.row}</span>
              </Tooltip>
            </Circle>
          ))}

          {/* Layer 2: Income Demographics (ZIP zones colored by median household income) */}
          {layers.income && incomeZips.map((zip, idx) => (
            <Circle
              key={`income-${idx}`}
              center={[zip.lat, zip.lng]}
              radius={getZipCircleRadius()}
              pathOptions={{
                color: getIncomeColor(zip.medianHouseholdIncome, minIncome, maxIncome),
                fillColor: getIncomeColor(zip.medianHouseholdIncome, minIncome, maxIncome),
                fillOpacity: 0.5,
                weight: 2,
              }}
            >
              <Tooltip>
                <strong>ZIP {zip.zip}</strong>
                <br />
                Median Household Income: ${(zip.medianHouseholdIncome || 0).toLocaleString()}
                <br />
                Distance: {zip.distance} miles from center
              </Tooltip>
            </Circle>
          ))}

          {/* Layer 3: Parent Origin Heatmap (theoretical distribution) */}
          {layers.parentOrigin && parentOriginZones.map((zone, idx) => {
            if (!zone.parentCount || zone.parentCount < 1) return null
            return (
              <Circle
                key={`parent-${idx}`}
                center={[zone.lat, zone.lng]}
                radius={getZipCircleRadius()}
                pathOptions={{
                  color: getParentOriginColor(zone.parentCount),
                  fillColor: getParentOriginColor(zone.parentCount),
                  fillOpacity: 0.6,
                  weight: 2,
                }}
              >
                <Tooltip>
                  <strong>Theoretical Parent Origin</strong>
                  <br />
                  ZIP {zone.zip}: ~{zone.parentCount} of 100 parents
                  <br />
                  Distance: {zone.distance} miles from center
                  <br />
                  <span className="text-xs text-gray-500">(Synthetic distance-decay model)</span>
                </Tooltip>
              </Circle>
            )
          })}
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200 text-sm" style={{ maxWidth: '320px' }}>
          <h3 className="font-semibold text-gray-900 mb-3">Legend</h3>
          
          {layers.seo && (
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="font-medium text-gray-700 mb-2">🎯 SEO Rankings (400m grid)</p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }}></div>
                  <span>Rank 1-3 (excellent visibility)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#84cc16' }}></div>
                  <span>Rank 4-7 (good visibility)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#eab308' }}></div>
                  <span>Rank 8-10 (fair visibility)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }}></div>
                  <span>Rank 11-15 (poor visibility)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
                  <span>Rank 16-20 (weak visibility)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#9ca3af' }}></div>
                  <span>Unranked (no visibility)</span>
                </div>
              </div>
            </div>
          )}
          
          {layers.income && (
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="font-medium text-gray-700 mb-2">💰 Median Household Income (by ZIP)</p>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-12 h-3 rounded" style={{ 
                  background: 'linear-gradient(to right, #e9d5ff, #7c3aed)' 
                }}></div>
                <span className="text-xs text-gray-600">Low → High</span>
              </div>
              <p className="text-xs text-gray-500">
                Range: ${(minIncome / 1000).toFixed(0)}K - ${(maxIncome / 1000).toFixed(0)}K
              </p>
            </div>
          )}
          
          {layers.parentOrigin && (
            <div>
              <p className="font-medium text-gray-700 mb-2">👨‍👩‍👧 Parent Origin (theoretical)</p>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-12 h-3 rounded" style={{ 
                  background: 'linear-gradient(to right, #dbeafe, #1e40af)' 
                }}></div>
                <span className="text-xs text-gray-600">Few → Many</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Synthetic distance-decay model representing likely parent distribution
              </p>
            </div>
          )}
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-600 italic">
              <strong>The Insight:</strong> Poor SEO rank in high-income zones near the school = growth opportunity
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
