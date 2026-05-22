'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import 'leaflet/dist/leaflet.css'

// Dynamically import map components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false })
const Circle = dynamic(() => import('react-leaflet').then((mod) => mod.Circle), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false })

// Fix for default marker icons in React-Leaflet
if (typeof window !== 'undefined') {
  const L = require('leaflet')
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

export default function LeadIntelPanel() {
  const [form, setForm] = useState({
    name: '',
    centerName: '',
    address: '',
    zip: '',
    website: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function updateForm(patch) {
    setForm((current) => ({ ...current, ...patch }))
  }

  async function runIntel() {
    if (!form.address && !form.zip) {
      setError('Please provide either an address or a zip code')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const params = new URLSearchParams({
        address: form.address,
        zip: form.zip,
        website: form.website,
        name: form.centerName || form.name,
      })

      const res = await fetch(`/api/recon/lead-intel?${params}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to fetch lead intel')

      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Lead Intelligence</div>
            <h2 className="mt-2 text-2xl font-bold text-white">Pre-Call Prospect Brief</h2>
            <p className="mt-1 text-sm text-gray-400">Get a complete intelligence brief on any prospect in seconds.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input
            value={form.name}
            onChange={(e) => updateForm({ name: e.target.value })}
            placeholder="Prospect name (e.g., Sarah Smith)"
            className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50"
          />
          <input
            value={form.centerName}
            onChange={(e) => updateForm({ centerName: e.target.value })}
            placeholder="Center name (e.g., Little Stars Academy)"
            className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50"
          />
          <input
            value={form.website}
            onChange={(e) => updateForm({ website: e.target.value })}
            placeholder="Website URL (optional)"
            className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50"
          />
          <input
            value={form.address}
            onChange={(e) => updateForm({ address: e.target.value })}
            placeholder="Full address"
            className="md:col-span-2 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50"
          />
          <input
            value={form.zip}
            onChange={(e) => updateForm({ zip: e.target.value })}
            placeholder="ZIP code"
            className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-300 focus:border-violet-500/50"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={runIntel}
            disabled={loading}
            className="rounded-2xl bg-[var(--brand-primary-2)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-3)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Run Lead Intel'}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Demographics Card */}
          <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Market Demographics</div>
            <div className="mt-1 text-xs text-gray-400">ZIP {result.prospect.zip}</div>
            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-gray-300">Total Population</div>
                <div className="mt-1 text-2xl font-bold text-white">
                  {result.demographics.population?.toLocaleString() || '—'}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-gray-300">Families with Kids</div>
                <div className="mt-1 text-2xl font-bold text-white">
                  {result.demographics.familiesWithKids?.toLocaleString() || '—'}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-gray-300">Median Household Income</div>
                <div className="mt-1 text-2xl font-bold text-white">
                  ${result.demographics.medianIncome?.toLocaleString() || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Competitor Map Card */}
          <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Competitor Landscape</div>
            <div className="mt-1 text-xs text-gray-400">Within 3 and 5 mile radius</div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-gray-300">Within 3 Miles</div>
                <div className="mt-1 text-2xl font-bold text-blue-300">
                  {result.competitors.within3miles.length}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-gray-300">Within 5 Miles</div>
                <div className="mt-1 text-2xl font-bold text-orange-300">
                  {result.competitors.within5miles.length}
                </div>
              </div>
            </div>

            {/* Competitor Map */}
            {result.competitors.within3miles.length > 0 && result.competitors.within3miles[0].location && (
              <div className="mt-5 h-[300px] overflow-hidden rounded-2xl border border-[var(--brand-border)]">
                <MapContainer
                  center={[
                    result.competitors.within3miles[0].location.lat,
                    result.competitors.within3miles[0].location.lng,
                  ]}
                  zoom={12}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {/* 3-mile radius */}
                  <Circle
                    center={[
                      result.competitors.within3miles[0].location.lat,
                      result.competitors.within3miles[0].location.lng,
                    ]}
                    radius={4828}
                    pathOptions={{ color: 'blue', fillOpacity: 0.1 }}
                  />
                  
                  {/* 5-mile radius */}
                  <Circle
                    center={[
                      result.competitors.within3miles[0].location.lat,
                      result.competitors.within3miles[0].location.lng,
                    ]}
                    radius={8047}
                    pathOptions={{ color: 'orange', fillOpacity: 0.05, dashArray: '10, 10' }}
                  />

                  {/* Competitor markers */}
                  {result.competitors.within5miles.map((comp, idx) => (
                    comp.location && (
                      <Marker key={idx} position={[comp.location.lat, comp.location.lng]}>
                        <Popup>
                          <div className="text-sm">
                            <div className="font-semibold">{comp.name}</div>
                            <div className="text-xs text-gray-600">
                              {comp.rating} ⭐ ({comp.reviews} reviews)
                            </div>
                            <div className="text-xs text-gray-500">{comp.address}</div>
                          </div>
                        </Popup>
                      </Marker>
                    )
                  ))}
                </MapContainer>
              </div>
            )}

            {/* Competitor List */}
            <div className="mt-4 space-y-2 max-h-[200px] overflow-y-auto">
              {result.competitors.within3miles.slice(0, 5).map((comp, idx) => (
                <div key={idx} className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-2">
                  <div className="text-sm font-medium text-white">{comp.name}</div>
                  <div className="text-xs text-gray-400">
                    {comp.rating} ⭐ ({comp.reviews} reviews) • {comp.address}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Digital Presence Card */}
          <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Digital Presence</div>
            <div className="mt-1 text-xs text-gray-400">GBP, website speed, and ads</div>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-gray-300">Google Business Profile</div>
                <div className="mt-2 flex items-center gap-3">
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${result.digitalPresence.gbp.claimed ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>
                    {result.digitalPresence.gbp.claimed ? 'Claimed ✓' : 'Not Claimed'}
                  </span>
                  {result.digitalPresence.gbp.claimed && (
                    <div className="text-sm text-white">
                      {result.digitalPresence.gbp.rating} ⭐ ({result.digitalPresence.gbp.reviews} reviews)
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-gray-300">PageSpeed Insights</div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-400">Mobile</div>
                    <div className={`text-2xl font-bold ${result.digitalPresence.pageSpeed.mobile >= 50 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {result.digitalPresence.pageSpeed.mobile}/100
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Desktop</div>
                    <div className={`text-2xl font-bold ${result.digitalPresence.pageSpeed.desktop >= 50 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {result.digitalPresence.pageSpeed.desktop}/100
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-gray-300">Google Ads</div>
                <div className="mt-1 text-sm text-white capitalize">{result.digitalPresence.googleAds}</div>
              </div>
            </div>
          </div>

          {/* Pitch Angle Card */}
          <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Recommended Pitch Angle</div>
            <div className="mt-1 text-xs text-gray-400">AI-generated based on prospect data</div>
            <div className="mt-5 rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-4">
              <p className="text-base leading-relaxed text-white">{result.pitchAngle}</p>
            </div>
            <div className="mt-4 text-xs text-gray-400">
              Generated at {new Date(result.generatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
