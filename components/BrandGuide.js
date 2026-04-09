'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── helpers ──────────────────────────────────────────────────────────────────
function swatch(hex) {
  return <span className="inline-block w-5 h-5 rounded-md border border-white/10 shrink-0" style={{ backgroundColor: hex }} />
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200) }}
      className="text-[11px] text-gray-300 hover:text-violet-300 transition ml-1"
      title="Copy"
    >
      {copied ? '✓' : text}
    </button>
  )
}

function EditableText({ value, onSave, multiline = false, className = '' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef(null)

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  function commit() {
    setEditing(false)
    if (draft !== value) onSave(draft)
  }

  if (editing) {
    const props = {
      ref,
      value: draft,
      onChange: (e) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e) => { if (!multiline && e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } },
      className: `w-full rounded-lg border border-violet-500/50 bg-black/60 px-2 py-1 text-sm text-white focus:outline-none ${className}`,
    }
    return multiline ? <textarea {...props} rows={3} /> : <input {...props} />
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-text hover:bg-violet-500/10 rounded px-1 -mx-1 transition ${className}`}
      title="Click to edit"
    >
      {value || <span className="text-gray-300 italic">Click to add…</span>}
    </span>
  )
}

function Panel({ title, children, action }) {
  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-black/30 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--brand-border)]">
        <span className="text-sm font-semibold text-white">{title}</span>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function UploadZone({ category, label, accept = '*', onUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef()

  async function upload(file) {
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('category', category)
    fd.append('name', file.name)
    try {
      const res = await fetch('/api/mission-control/brand', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.ok && onUploaded) onUploaded(json.url, file.name)
    } catch {}
    setUploading(false)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files[0]) }}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-5 cursor-pointer transition ${dragOver ? 'border-violet-500/60 bg-violet-500/10' : 'border-[var(--brand-border)] hover:border-violet-500/40 hover:bg-violet-500/5'}`}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => upload(e.target.files[0])} />
      {uploading
        ? <><div className="w-5 h-5 border-2 border-[#AE2BCF] border-t-transparent rounded-full animate-spin" /><span className="text-xs text-gray-400">Uploading…</span></>
        : <><span className="text-2xl">📁</span><span className="text-xs text-gray-400">{label}</span><span className="text-[11px] text-gray-300">Drop or click to upload</span></>}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────
export default function BrandGuide() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState('overview')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mission-control/brand')
      setData(await res.json())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function api(body) {
    await fetch('/api/mission-control/brand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    await load()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-[#AE2BCF] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!data) return <div className="text-red-300 py-8">Failed to load brand guide.</div>

  const sections = [
    ['overview',   '🏢 Overview'],
    ['colors',     '🎨 Colors'],
    ['typography', '✏️  Typography'],
    ['logos',      '🖼️  Logos'],
    ['voice',      '💬 Voice & Tone'],
    ['templates',  '📄 Templates'],
    ['media',      '📸 Media Library'],
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">🏢 GYC Brand Guide</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Living brand reference — click any text to edit. Last updated {data.lastUpdated ? new Date(data.lastUpdated).toLocaleDateString() : '—'} by {data.updatedBy || '—'}.
          </p>
        </div>
      </div>

      {/* Section nav */}
      <div className="flex flex-wrap gap-2">
        {sections.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${section === key ? 'border-violet-500/40 bg-violet-500/15 text-violet-100' : 'border-[var(--brand-border)] bg-black/20 text-gray-400 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {section === 'overview' && (
        <div className="space-y-4">
          <Panel title="Brand Identity">
            <div className="space-y-3 text-sm">
              {[
                ['Full Name', 'brand.name'],
                ['Short Name', 'brand.shortName'],
                ['Tagline', 'brand.tagline'],
                ['Mission', 'brand.mission'],
              ].map(([label, path]) => (
                <div key={path}>
                  <p className="text-gray-300 text-xs uppercase tracking-wider mb-0.5">{label}</p>
                  <EditableText
                    value={path.split('.').reduce((o, k) => o?.[k], data) || ''}
                    onSave={(v) => api({ action: 'update_field', path, value: v })}
                    multiline={label === 'Mission'}
                    className="text-white"
                  />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Quick Brand Preview">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-300 uppercase tracking-wider mb-2">Color Palette</p>
                <div className="flex flex-wrap gap-2">
                  {[...data.colors?.primary || [], ...data.colors?.secondary || []].map((c) => (
                    <div key={c.hex} className="flex items-center gap-2 rounded-lg border border-[var(--brand-border)] px-3 py-1.5">
                      {swatch(c.hex)}
                      <span className="text-xs text-gray-300">{c.name}</span>
                      <CopyBtn text={c.hex} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-300 uppercase tracking-wider mb-2">Primary Font</p>
                <span className="text-white text-lg font-semibold" style={{ fontFamily: data.typography?.primary?.family }}>
                  {data.typography?.primary?.family}
                </span>
                <span className="text-gray-300 text-xs ml-3">All headings, body copy, and UI</span>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ── Colors ── */}
      {section === 'colors' && (
        <div className="space-y-4">
          {Object.entries(data.colors || {}).map(([palette, colors]) => (
            <Panel
              key={palette}
              title={palette.charAt(0).toUpperCase() + palette.slice(1) + ' Colors'}
              action={
                <button
                  onClick={() => {
                    const hex = prompt('Hex color (e.g. #FF0000)')
                    const name = prompt('Color name')
                    const usage = prompt('Usage description')
                    if (hex && name) api({ action: 'add_color', palette, color: { name, hex, usage } })
                  }}
                  className="text-xs text-violet-300 hover:text-violet-100 border border-violet-500/30 rounded-full px-2.5 py-0.5 transition"
                >
                  + Add
                </button>
              }
            >
              <div className="space-y-3">
                {colors.map((color) => (
                  <div key={color.hex} className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl border border-white/10 shrink-0" style={{ backgroundColor: color.hex }} />
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{color.name}</span>
                        <CopyBtn text={color.hex} />
                      </div>
                      <p className="text-gray-300 text-xs mt-0.5">{color.usage}</p>
                    </div>
                    <button
                      onClick={() => { if (confirm(`Remove ${color.name}?`)) api({ action: 'remove_color', palette, hex: color.hex }) }}
                      className="text-gray-200 hover:text-rose-400 text-xs transition mt-1"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {/* ── Typography ── */}
      {section === 'typography' && (
        <div className="space-y-4">
          <Panel title="Primary Typeface">
            <div className="space-y-6">
              <div>
                <p className="text-xs text-gray-300 uppercase tracking-wider mb-2">Font Family</p>
                <EditableText
                  value={data.typography?.primary?.family || ''}
                  onSave={(v) => api({ action: 'update_field', path: 'typography.primary.family', value: v })}
                  className="text-white text-2xl font-bold"
                />
              </div>
              <div>
                <p className="text-xs text-gray-300 uppercase tracking-wider mb-3">Type Scale Preview</p>
                {[
                  ['Heading 1', '32px / bold', 'text-3xl font-bold'],
                  ['Heading 2', '24px / semibold', 'text-2xl font-semibold'],
                  ['Heading 3', '20px / semibold', 'text-xl font-semibold'],
                  ['Body', '16px / regular', 'text-base'],
                  ['Small', '14px / regular', 'text-sm'],
                  ['Caption', '12px / regular', 'text-xs'],
                ].map(([level, spec, cls]) => (
                  <div key={level} className="flex items-baseline gap-4 py-2 border-b border-[var(--brand-border)] last:border-0">
                    <span className={`text-white ${cls}`} style={{ fontFamily: data.typography?.primary?.family }}>
                      {data.brand?.name || 'Grow Your Childcare'}
                    </span>
                    <span className="text-gray-300 text-xs shrink-0">{level} — {spec}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs text-gray-300 uppercase tracking-wider mb-2">Fallback Stack</p>
                <p className="text-gray-400 text-sm">{(data.typography?.primary?.fallbacks || []).join(', ')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-300 uppercase tracking-wider mb-2">Notes</p>
                <EditableText
                  value={data.typography?.notes || ''}
                  onSave={(v) => api({ action: 'update_field', path: 'typography.notes', value: v })}
                  multiline
                  className="text-gray-300 text-sm"
                />
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ── Logos ── */}
      {section === 'logos' && (
        <div className="space-y-4">
          <Panel title="Logo Variants">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(data.logo?.variants || []).map((variant) => (
                <div key={variant.name} className="rounded-xl border border-[var(--brand-border)] bg-black/20 overflow-hidden">
                  <div className={`flex items-center justify-center h-32 ${variant.name.toLowerCase().includes('white') || variant.name.toLowerCase().includes('revers') ? 'bg-gray-800' : 'bg-white/5'}`}>
                    {variant.file
                      ? <img src={variant.file} alt={variant.name} className="max-h-24 max-w-full object-contain" />
                      : <span className="text-gray-300 text-xs">No file uploaded</span>}
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-white text-sm font-medium">{variant.name}</p>
                    <p className="text-gray-300 text-xs">{variant.usage}</p>
                    <UploadZone
                      category="logos"
                      label={`Upload ${variant.name}`}
                      accept="image/*,.svg,.pdf,.ai,.eps"
                      onUploaded={(url) => api({ action: 'update_logo_variant', variantName: variant.name, file: url })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Logo Usage Rules">
            <div className="space-y-2">
              <p className="text-xs text-gray-300 uppercase tracking-wider mb-2">Clear Space</p>
              <EditableText
                value={data.logo?.clearspace || ''}
                onSave={(v) => api({ action: 'update_field', path: 'logo.clearspace', value: v })}
                className="text-gray-300 text-sm"
              />
              <p className="text-xs text-gray-300 uppercase tracking-wider mt-4 mb-2">Don't Do</p>
              <ul className="space-y-1.5">
                {(data.logo?.dontDo || []).map((rule, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                    <span className="text-rose-500 mt-0.5">✕</span>{rule}
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </div>
      )}

      {/* ── Voice & Tone ── */}
      {section === 'voice' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Panel title="Tone">
              <EditableText
                value={data.voice?.tone || ''}
                onSave={(v) => api({ action: 'update_field', path: 'voice.tone', value: v })}
                multiline
                className="text-gray-300 text-sm"
              />
            </Panel>
            <Panel title="Audience">
              <EditableText
                value={data.voice?.audience || ''}
                onSave={(v) => api({ action: 'update_field', path: 'voice.audience', value: v })}
                multiline
                className="text-gray-300 text-sm"
              />
            </Panel>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Panel title="✅ Do Say">
              <ul className="space-y-2">
                {(data.voice?.doSay || []).map((phrase, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-emerald-300">
                    <span>✓</span>{phrase}
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="✕ Don't Say">
              <ul className="space-y-2">
                {(data.voice?.dontSay || []).map((phrase, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-rose-300">
                    <span>✕</span>{phrase}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
          <Panel title="Writing Rules">
            <ul className="space-y-2">
              {(data.voice?.writingRules || []).map((rule, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-[#AE2BCF] mt-0.5 shrink-0">→</span>{rule}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {/* ── Templates ── */}
      {section === 'templates' && (
        <div className="space-y-4">
          <Panel title="Presentation & Report Templates">
            <div className="space-y-4">
              <UploadZone
                category="templates"
                label="Upload template (PPTX, DOCX, PDF, Google Slides link, etc.)"
                accept=".pptx,.docx,.pdf,.key,.gslides,.zip"
                onUploaded={(url, name) => {
                  /* data already updated via API, just reload */
                  load()
                }}
              />
              {(data.templates?.items || []).length === 0 ? (
                <p className="text-sm text-gray-300 text-center py-4">No templates uploaded yet. Drop files above to add them.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {data.templates.items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-[var(--brand-border)] bg-black/20 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-2xl">{item.file?.endsWith('.pdf') ? '📄' : item.file?.endsWith('.pptx') ? '📊' : item.file?.endsWith('.docx') ? '📝' : '📁'}</div>
                        <button
                          onClick={() => { if (confirm(`Remove ${item.name}?`)) api({ action: 'remove_template', id: item.id }) }}
                          className="text-gray-200 hover:text-rose-400 text-xs transition"
                        >✕</button>
                      </div>
                      <p className="text-white text-sm font-medium mt-2">{item.name}</p>
                      {item.description && <p className="text-gray-300 text-xs mt-0.5">{item.description}</p>}
                      <a href={item.file} download className="mt-2 inline-block text-xs text-violet-300 hover:text-violet-100 transition">
                        ↓ Download
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* ── Media Library ── */}
      {section === 'media' && (
        <div className="space-y-4">
          <Panel title="Photo Style Guidelines">
            <ul className="space-y-2">
              {(data.mediaLibrary?.photoStyle || []).map((rule, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-[#AE2BCF] mt-0.5 shrink-0">→</span>{rule}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Brand Media Library">
            <div className="space-y-4">
              <UploadZone
                category="media"
                label="Upload brand assets (logos, photos, graphics, icons)"
                accept="image/*,.svg,.ai,.eps,.pdf"
                onUploaded={() => load()}
              />
              {(data.mediaLibrary?.items || []).length === 0 ? (
                <p className="text-sm text-gray-300 text-center py-4">No assets uploaded yet. Drop files above to add them.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {data.mediaLibrary.items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-[var(--brand-border)] bg-black/20 overflow-hidden group">
                      <div className="relative h-28 bg-white/5">
                        {item.file?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
                          ? <img src={item.file} alt={item.name} className="w-full h-full object-contain p-2" />
                          : <div className="flex items-center justify-center h-full text-3xl">📁</div>}
                        <button
                          onClick={() => { if (confirm(`Remove ${item.name}?`)) api({ action: 'remove_media', id: item.id }) }}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-gray-200 hover:text-rose-400 text-xs transition bg-black/60 rounded-full w-5 h-5 flex items-center justify-center"
                        >✕</button>
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="text-white text-xs font-medium truncate">{item.name}</p>
                        <a href={item.file} download className="text-[11px] text-violet-400 hover:text-violet-200 transition">↓ Download</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}
