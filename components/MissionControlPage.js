'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import BrandGuide from '@/components/BrandGuide'
import FulcrumIntel from '@/components/FulcrumIntel'
import ClientHealthMonitor from '@/components/ClientHealthMonitor'
import AgentEventLog from '@/components/AgentEventLog'

function fmtEpoch(epoch) {
  if (!epoch) return '—'
  return new Date(epoch * 1000).toLocaleString()
}

function fmtIso(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

// ─── Agent Org Chart ────────────────────────────────────────────────────────
const AGENT_META = {
  'Wall·E':    { img: '/agents/walle.svg',     glow: '#7c3aed', border: '#7c3aed', bg: '#1e0b40' },
  'Eve':       { img: '/agents/eve.svg',       glow: '#0891b2', border: '#0891b2', bg: '#051e2b' },
  'R2':        { img: '/agents/r2.svg',        glow: '#2563eb', border: '#2563eb', bg: '#061229' },
  'BB-8':      { img: '/agents/bb8.svg',       glow: '#d97706', border: '#d97706', bg: '#1f1005' },
  'Fulcrum':   { img: '/agents/fulcrum.svg',   glow: '#db2777', border: '#db2777', bg: '#200820' },
  'Friday':    { img: '/agents/friday.svg',    glow: '#4f46e5', border: '#4f46e5', bg: '#0d0b2e' },
  'Chopper':   { img: '/agents/chopper.svg',   glow: '#0d9488', border: '#0d9488', bg: '#04191a' },
  'Echo':     { img: '', glow: '#16a34a', border: '#16a34a', bg: '#031507' },
  'C3PO': { img: '', glow: '#ca8a04', border: '#ca8a04', bg: '#1a1202' },
  'Ratchet':  { img: '', glow: '#dc2626', border: '#dc2626', bg: '#1f0505' },
  'Vision':  { img: '', glow: '#7e22ce', border: '#7e22ce', bg: '#190730' },
  'Mini-2':    { img: '', glow: '#374151', border: '#374151', bg: '#0a0a0a' },
  'Yoda':    { img: '', glow: '#9333ea', border: '#9333ea', bg: '#1a0533' },
  'Thrawn':     { img: '', glow: '#0d9488', border: '#0d9488', bg: '#021a18' },
  'Soundwave':      { img: '', glow: '#f59e0b', border: '#f59e0b', bg: '#1c0f00' },
  'Monday':    { img: '', glow: '#2563eb', border: '#2563eb', bg: '#04102a' },
  'Scribe':    { img: '', glow: '#c2410c', border: '#c2410c', bg: '#1c0800' },
  'Arbiter':   { img: '', glow: '#7c3aed', border: '#7c3aed', bg: '#1e0b40' },
}

function statusDot(status) {
  if (status === 'working')   return '#34d399'
  if (status === 'attention') return '#fbbf24'
  if (status === 'planned')   return '#60a5fa'
  return '#374151'
}

const CARD_DIMS = {
  xl: { w: 230, h: 240, pad: '14px 16px', emoji: 28, avatar: 54, nameSize: 15 },
  lg: { w: 200, h: 210, pad: '12px 14px', emoji: 24, avatar: 44, nameSize: 13 },
  md: { w: 185, h: 200, pad: '10px 12px', emoji: 22, avatar: 40, nameSize: 13 },
  sm: { w: 170, h: 195, pad: '10px 12px', emoji: 20, avatar: 36, nameSize: 12 },
}

const STATUS_LABEL = {
  working:   { text: 'Working',         color: '#34d399' },
  attention: { text: 'Needs Attention', color: '#fbbf24' },
  planned:   { text: 'Pending Setup',   color: '#60a5fa' },
  idle:      { text: 'Idle',            color: '#6b7280' },
}

const AGENT_MODEL = {
  'Wall·E':  'Claude Sonnet',
  'Eve':     'GPT-5.3-Codex',
  'R2':      'GPT-5.4',
  'Yoda':  'Claude Opus',
  'Thrawn':   'Claude Haiku',
  'Soundwave':    'Claude Haiku',
  'Echo':    'Claude Haiku',
  'C3PO':   'Claude Haiku',
  'Ratchet': 'Claude Haiku',
  'BB-8':    'GPT-5.3-Codex',
  'Fulcrum': 'Claude Haiku',
  'Vision':  'Claude Haiku',
  'Friday':  'TBD',
  'Chopper': 'TBD',
  'Monday':  'Claude Haiku',
  'Scribe':  'Claude Haiku',
  'Arbiter': 'Claude Haiku',
}

const AGENT_MODEL_ACCESS = {
  'Wall·E':    { default: 'Claude Sonnet', escalate: 'Opus (via Yoda)' },
  'Eve':       { default: 'GPT-5.3-Codex', escalate: null },
  'R2':        { default: 'GPT-5.4', escalate: null },
  'Yoda':      { default: 'Claude Opus', escalate: null },
  'Thrawn':     { default: 'Claude Haiku', escalate: 'Sonnet (via Wall·E)' },
  'Soundwave': { default: 'Claude Haiku', escalate: 'Sonnet (via Wall·E)' },
  'Echo':      { default: 'Claude Haiku', escalate: null },
  'C3PO':      { default: 'Claude Haiku', escalate: null },
  'Ratchet':   { default: 'Claude Haiku', escalate: null },
  'BB-8':      { default: 'GPT-5.3-Codex', escalate: null },
  'Fulcrum':   { default: 'Claude Haiku', escalate: 'Sonnet (via Wall·E)' },
  'Vision':    { default: 'Claude Haiku', escalate: null },
  'Friday':    { default: 'TBD', escalate: null },
  'Chopper':   { default: 'TBD', escalate: null },
  'Monday':    { default: 'Claude Haiku', escalate: null },
  'Scribe':    { default: 'Claude Haiku', escalate: null },
  'Arbiter':   { default: 'Claude Haiku', escalate: null },
}

const AGENT_RESPONSIBILITIES = {
  'Wall·E':  ['Primary orchestrator for all GYC AI operations', 'Manages agent fleet task routing and coordination', 'Strategy, planning, and daily decision-making with Todd', 'Bridges all data, tools, and agents into coherent output', 'The human-facing intelligence layer — everything routes through here'],
  'Eve':     ['Runs all scheduled data sync jobs (Stripe, GHL, Zendesk, Sheets)', 'Writes all raw and normalized data into Neon PostgreSQL', 'Owns the data pipeline — source of truth for every dashboard metric', 'Runs independently on Mac Studio for reliability isolation', 'Eve writes, Wall·E reads — clean data ownership separation'],
  'R2':      ['Builds and maintains GYC KPI dashboard and Team Portal', 'Executes all coding: features, scripts, API integrations, bug fixes', 'Handles Next.js, Prisma, Neon, Recharts, Tailwind stack', 'Receives task specs from Wall·E, delivers working code', 'Primary implementation engine for all Mac Mini software'],
  'Yoda':  ['Reserved for deep analysis requiring maximum reasoning depth', 'Handles complex multi-variable decisions and long-form synthesis', 'Engaged sparingly — highest cost model, highest quality output', 'Wall·E escalates to Yoda when standard reasoning is insufficient', 'Strategic advisory layer — never for routine tasks'],
  'Thrawn':   ['Daily business intelligence sweeps against live Neon data', 'Detects churn risk, billing failures, and at-risk client signals early', 'Identifies upsell opportunities from active client engagement patterns', 'Monitors sales velocity, close rate trends, and rep performance shifts', 'Writes actionable memos to Wall·E — the CMO-level radar system'],
  'Soundwave':    ['Processes every new Zoom sales and GA call transcript daily', 'Scores rep performance: talk/listen ratio, objection handling, commitment close', 'Detects recurring objection patterns and conversion blockers across calls', 'Writes per-rep coaching notes and weekly team performance summaries', 'Feeds structured analysis into Neon for Client Intel and M3 call review'],
  'Echo':    ['Routes task assignments across the entire agent fleet', 'Tracks task status and completion for all active agents', 'Generates concise progress summaries for Wall·E to relay to Todd', 'Maintains the task log and flags stalled or blocked work early', 'Coordination layer — keeps the fleet moving without Wall·E micromanaging'],
  'C3PO':   ['Validates all builds before they are marked user-facing or deployed', 'Runs smoke tests, build checks, and regression scans on new code', 'Reviews code diffs for obvious bugs, broken routes, or regressions', 'Returns structured pass/fail reports with failure details to Wall·E', 'The release gate — nothing ships without C3PO sign-off'],
  'Ratchet': ['Monitors heartbeat and status of every agent in the fleet', 'Scans cron job history for errors, missed runs, or degraded patterns', 'Detects offline agents, stuck tasks, and escalating failure patterns', 'Alerts Wall·E with actionable fleet health summaries daily', 'The fleet immune system — catches problems before Todd ever notices them'],
  'BB-8':    ['Eve\'s dedicated coding agent running on Mac Studio', 'Builds and maintains all sync scripts, pipeline jobs, and Eve-side tooling', 'Handles Mac Studio automations and data transformation scripts', 'Works in concert with Eve — BB-8 builds the tools that Eve runs', 'Mirrors R2\'s role but scoped entirely to the data infrastructure layer'],
  'Fulcrum': ['Researches the external landscape: competitors, industry trends, best practices', 'Produces structured research memos with evidence and GYC-specific implications', 'Covers: childcare marketing, AI tooling, sales benchmarks, growth playbooks', 'Rotates through topic library on a defined cadence — no topic goes stale', 'The strategic antenna — keeps GYC\'s knowledge current with what\'s happening outside'],
  'Vision':  ['Runs scheduled security posture audits on both Mac Mini and Mac Studio', 'Validates snapshot freshness — ensures no dashboard is ever showing stale data', 'Monitors for anomalous processes, failed auth attempts, or unexpected changes', 'Detects data integrity issues: mismatched counts, broken syncs, schema drift', 'The security and data quality enforcer — silent until something is wrong'],
  'Friday':  ['Laptop-based orchestrator for remote and travel operations (planned)', 'Manages a lightweight agent cluster when Todd is away from base nodes', 'Handles mobile-first interactions and time-sensitive routing decisions', 'Coordinates handoff with Wall·E when returning to base', 'Ensures GYC operations continue uninterrupted regardless of Todd\'s location'],
  'Chopper': ['Friday\'s execution worker running on the laptop node (planned)', 'Handles lightweight task execution in remote and travel contexts', 'Runs scripts, lookups, and quick responses under Friday\'s direction', 'Built lean and fast for laptop hardware constraints', 'The mobile utility agent — reliable and low-resource on the go'],
  'Monday':  ['Serves all client-facing M3 dashboard reads for external tenants (planned)', 'Handles per-client data requests filtered strictly by tenant ID', 'Isolates client-portal query load completely from internal GYC ops', 'Manages M3 caching, refresh cycles, and client-specific data views', 'Eve writes the data in — Monday serves it out to GYC\'s paying clients'],
  'Scribe':  ['Generates client-facing monthly performance reports and GA summaries (planned)', 'Writes structured proposals, meeting prep documents, and deliverables on demand', 'Transforms raw Neon data into readable, branded client-facing language', 'Runs Growth Advisor meeting briefs and post-meeting follow-up summaries', 'Turns the AI network\'s intelligence into polished human-readable output'],
  'Arbiter': ['Manages inter-agent routing and task escalation at scale (planned)', 'Dispatches incoming tasks to the correct agent based on routing rules', 'Handles escalation chains when agents flag unresolved or blocked issues', 'Maintains and updates the routing rules table under Wall·E\'s direction', 'As the fleet grows to serve external M3 clients, Arbiter becomes the load balancer'],
}

function AgentCard({ agent, size = 'md' }) {
  const m = AGENT_META[agent.name] || { img: '', glow: '#7c3aed', border: '#7c3aed', bg: '#1e0b40' }
  const isPlanned = agent.status === 'planned'
  const d = CARD_DIMS[size] || CARD_DIMS.md
  const sl = STATUS_LABEL[agent.status] || STATUS_LABEL.idle
  const model = AGENT_MODEL[agent.name] || null
  const modelAccess = AGENT_MODEL_ACCESS[agent.name] || { default: model || '—', escalate: null }
  const responsibilities = AGENT_RESPONSIBILITIES[agent.name] || []

  return (
    <div style={{
      width: d.w,
      minHeight: d.h,
      backgroundColor: isPlanned ? '#111827' : m.bg,
      border: `${isPlanned ? '1px dashed #4b5563' : `1px solid ${m.border}66`}`,
      boxShadow: isPlanned ? 'none' : `0 0 32px ${m.glow}30`,
      borderRadius: 14,
      padding: d.pad,
      position: 'relative',
      opacity: isPlanned ? 0.65 : 1,
    }}>
      {/* Status glow strip at top */}
      {!isPlanned && (
        <div style={{
          position: 'absolute', top: 0, left: 16, right: 16, height: 2,
          background: `linear-gradient(90deg, transparent, ${m.glow}, transparent)`,
          borderRadius: 2,
        }} />
      )}

      {/* Name + avatar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {m.img
          ? <img src={m.img} alt={agent.name} style={{ width: d.avatar, height: d.avatar, borderRadius: 8, objectFit: 'contain', background: 'rgba(0,0,0,0.5)', flexShrink: 0, border: `1px solid ${m.border}44` }} />
          : <div style={{ width: d.avatar, height: d.avatar, borderRadius: 8, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: d.emoji, flexShrink: 0, border: `1px solid ${isPlanned ? '#4b5563' : m.border+'44'}` }}>🤖</div>
        }
        <div style={{ minWidth: 0 }}>
          <div style={{ color: isPlanned ? '#9ca3af' : '#fff', fontWeight: 700, fontSize: d.nameSize, lineHeight: 1.2 }}>{agent.name}</div>
          <div style={{ color: '#6b7280', fontSize: 10, lineHeight: 1.3, marginTop: 2 }}>{agent.node}</div>
          {size === 'xl' && !isPlanned && (
            <div style={{ color: m.glow, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>● Main Node</div>
          )}
        </div>
      </div>

      {/* Role */}
      <div style={{ color: isPlanned ? '#6b7280' : '#c4b5fd', fontSize: 10, marginBottom: 6, lineHeight: 1.4, fontWeight: 500 }}>{agent.role}</div>

      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, fontSize: 10, fontWeight: 600, color: sl.color }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: sl.color, display: 'inline-block', boxShadow: agent.status === 'working' ? `0 0 5px ${sl.color}` : 'none' }} />
        {sl.text}
      </div>

      {/* Responsibilities */}
      {responsibilities.length > 0 && (
        <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: 6, marginTop: 4 }}>
          {responsibilities.slice(0, size === 'xl' ? 4 : 3).map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginBottom: 2 }}>
              <span style={{ color: isPlanned ? '#6b7280' : m.glow, fontSize: 9, marginTop: 1, flexShrink: 0 }}>▸</span>
              <span style={{ color: isPlanned ? '#6b7280' : '#d1d5db', fontSize: 9.5, lineHeight: 1.4 }}>{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* Model section */}
      <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: 5, marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9.5 }}>
          <span style={{ color: '#6b7280' }}>Model:</span>
          <span style={{ color: '#c4b5fd', fontWeight: 600 }}>{modelAccess.default}</span>
        </div>
        {modelAccess.escalate && (
          <div style={{ fontSize: 9, color: '#4b5563', marginTop: 1 }}>
            ↑ {modelAccess.escalate}
          </div>
        )}
      </div>

      {/* Current task */}
      {agent.currentTask && !isPlanned && (
        <div style={{ color: '#6b7280', fontSize: 10, lineHeight: 1.4, marginTop: 5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', borderTop: '1px solid #1f1f2e', paddingTop: 5 }}>
          ⚡ {agent.currentTask}
        </div>
      )}
    </div>
  )
}

// SVG connector line between two DOM-positioned elements
function OrgLine({ x1, y1, x2, y2, color = '#4a3060', dashed = false }) {
  // Straight elbow: vertical down from parent, horizontal to child x, vertical down to child
  const midY = y1 + Math.round((y2 - y1) / 2)
  const path = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`
  return (
    <path
      d={path}
      stroke={color}
      strokeWidth={1.5}
      fill="none"
      strokeLinejoin="miter"
      strokeDasharray={dashed ? '5 3' : undefined}
      opacity={0.65}
    />
  )
}

function AgentOrgChart({ agents }) {
  // Fixed layout coordinates (centre-x, top-y) for each agent
  // Canvas: ~900px wide, rows at y=0, 220, 440
  const CARD_W = { xl: 210, lg: 176, md: 152, sm: 136 }
  const CARD_H = { xl: 130, lg: 110, md: 100, sm: 90 }

  // Row 0 — Todd (human, no card) at centre
  // Row 1 — Wall·E (centre) + Friday (right peer)
  // Row 2 — R2 (left of Wall·E), Eve (right of Wall·E)
  // Row 3 — BB-8, Fulcrum (under Eve) · Chopper (future, under Eve, planned)

  // Clean grid layout — generous spacing prevents ALL overlap
  // Mac Mini cluster: left half. Mac Studio cluster: right half. Friday: far right.
  // ─── Layout philosophy ────────────────────────────────────────────────────
  // Five vertical columns, each cluster owns its column, no overlap possible.
  // Row heights are generous. Wall·E at top centre.
  //
  //  Col A (x≈120)   Col B (x≈370)   Col C (x≈650)  Col D (x≈950)  Col E (x≈1250)
  //  Mini-2 (plan)   [gap]            Wall·E ★        Eve ★           Friday (plan)
  //  Axiom (plan)    R2               Relay            BB-8            Chopper (plan)
  //  Monday (plan)   Guardian         Validator        Fulcrum         —
  //  Scribe (plan)   —                —                Sentinel        —
  //  Arbiter (plan)  —                —                —               —
  //
  // Todd label sits above Wall·E.

  // Card heights: xl=240, md=200, sm=195. Gap between rows=70.
  const XH = 240, MH = 200, SH = 195, GAP = 70
  const R0 = 0
  const R1 = 60
  const R2 = R1 + XH + GAP    // 370
  const R3 = R2 + SH + GAP    // 635
  const R4 = R3 + SH + GAP    // 900
  const R5 = R4 + SH + GAP    // 1165
  const R6 = R5 + SH + GAP    // 1430

  const COL = { A: 115, B: 340, C: 575, D: 850, E: 1090 }
  const CANVAS_W = 1300
  const TODD_CX = COL.C

  const pos = {
    'Todd':      { cx: TODD_CX, cy: R0, size: null },
    'Mini-2':    { cx: COL.A,   cy: R1, size: 'sm', planned: true },
    'Yoda':      { cx: COL.B,   cy: R1, size: 'sm' },
    'Wall·E':    { cx: COL.C,   cy: R1, size: 'xl' },
    'Eve':       { cx: COL.D,   cy: R1, size: 'xl' },
    'Friday':    { cx: COL.E,   cy: R1, size: 'md', planned: true },
    'Thrawn':     { cx: COL.A,   cy: R2, size: 'sm' },
    'R2':        { cx: COL.B,   cy: R2, size: 'md' },
    'Echo':      { cx: COL.C,   cy: R2, size: 'sm' },
    'BB-8':      { cx: COL.D,   cy: R2, size: 'sm' },
    'Chopper':   { cx: COL.E,   cy: R2, size: 'sm', planned: true },
    'Soundwave':      { cx: COL.A,   cy: R3, size: 'sm' },
    'Ratchet':   { cx: COL.B,   cy: R3, size: 'sm' },
    'C3PO':      { cx: COL.C,   cy: R3, size: 'sm' },
    'Fulcrum':   { cx: COL.D,   cy: R3, size: 'sm' },
    'Monday':    { cx: COL.A,   cy: R4, size: 'sm', planned: true },
    'Vision':    { cx: COL.D,   cy: R4, size: 'sm' },
    'Scribe':    { cx: COL.A,   cy: R5, size: 'sm', planned: true },
    'Arbiter':   { cx: COL.A,   cy: R6, size: 'sm', planned: true },
  }

  const connections = [
    // Todd → Wall·E (primary), Todd → Eve (secondary direct), Todd → peers
    ['Todd',    'Wall·E',    { color: '#7c3aed' }],
    ['Todd',    'Mini-2',    { color: '#374151', dashed: true }],
    ['Todd',    'Friday',    { color: '#4f46e5', dashed: true }],
    // Wall·E orchestrates
    ['Wall·E',  'Eve',       { color: '#0891b2' }],
    ['Wall·E',  'Yoda',      { color: '#9333ea', dashed: true }],
    ['Wall·E',  'R2',        { color: '#2563eb' }],
    ['Wall·E',  'Echo',     { color: '#16a34a' }],
    ['Wall·E',  'Ratchet',  { color: '#dc2626' }],
    ['Wall·E',  'C3PO', { color: '#ca8a04' }],
    ['Wall·E',  'Friday',    { color: '#6d28d9', dashed: true }],
    // Eve workers
    ['Eve',     'BB-8',      { color: '#d97706' }],
    ['Eve',     'Fulcrum',   { color: '#db2777' }],
    ['Eve',     'Vision',  { color: '#7e22ce' }],
    // Friday worker
    ['Friday',  'Chopper',   { color: '#4f46e5', dashed: true }],
    // Mini-2 planned cluster
    ['Wall·E',  'Thrawn',     { color: '#0d9488' }],
    ['Wall·E',  'Soundwave',      { color: '#f59e0b' }],
    ['Mini-2',  'Monday',    { color: '#2563eb', dashed: true }],
    ['Mini-2',  'Scribe',    { color: '#c2410c', dashed: true }],
    ['Mini-2',  'Arbiter',   { color: '#7c3aed', dashed: true }],
  ]

  const agentByName = {}
  for (const a of agents) agentByName[a.name] = a

  // Card bottom-centre: cx, top-y + height
  function cardAnchor(name, edge = 'bottom') {
    const p = pos[name]
    if (!p) return null
    const sz = p.size || 'md'
    const h = CARD_H[sz] || 100
    const w = CARD_W[sz] || 152
    if (edge === 'bottom') return { x: p.cx, y: p.cy + h }
    if (edge === 'top')    return { x: p.cx, y: p.cy }
    if (edge === 'left')   return { x: p.cx - w/2, y: p.cy + h/2 }
    if (edge === 'right')  return { x: p.cx + w/2, y: p.cy + h/2 }
    return { x: p.cx, y: p.cy + h/2 }
  }

  // For connections: use bottom of parent, top of child
  function getEdges(fromName, toName) {
    const fp = pos[fromName], tp = pos[toName]
    if (!fp || !tp) return null
    const from = cardAnchor(fromName, 'bottom')
    const to   = cardAnchor(toName,   'top')
    return { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
  }

  const CANVAS_H = R6 + SH + 80

  return (
    <div style={{ background: 'radial-gradient(circle at 50% 20%, #1c0930, transparent 60%), linear-gradient(180deg,#08060e,#030305)', borderRadius: 20, border: '1px solid #2a1a3e', padding: '24px 16px 32px', overflowX: 'auto' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap', fontSize: 11, color: '#9ca3af' }}>
        <span style={{ display:'flex',alignItems:'center',gap:6 }}><span style={{width:20,height:2,background:'#7c3aed',display:'inline-block'}}/> Reports to Todd</span>
        <span style={{ display:'flex',alignItems:'center',gap:6 }}><span style={{width:20,height:2,background:'#6d28d9',borderTop:'2px dashed #6d28d9',display:'inline-block'}}/> Peer coordination</span>
        <span style={{ display:'flex',alignItems:'center',gap:6 }}><span style={{width:20,height:2,background:'#0891b2',display:'inline-block'}}/> Orchestrates</span>
        <span style={{ display:'flex',alignItems:'center',gap:6 }}><span style={{width:16,height:16,borderRadius:4,border:'1px dashed #6b7280',display:'inline-block'}}/> Planned / not yet live</span>
        <span style={{ display:'flex',alignItems:'center',gap:6 }}><span style={{width:8,height:8,borderRadius:'50%',background:'#34d399',display:'inline-block'}}/> Working</span>
        <span style={{ display:'flex',alignItems:'center',gap:6 }}><span style={{width:8,height:8,borderRadius:'50%',background:'#374151',display:'inline-block'}}/> Idle</span>
      </div>

      <div style={{ position: 'relative', width: CANVAS_W, height: CANVAS_H, margin: '0 auto' }}>
        {/* SVG lines layer */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
          {connections.map(([from, to, opts], i) => {
            const edges = getEdges(from, to)
            if (!edges) return null
            return <OrgLine key={i} {...edges} color={opts.color} dashed={opts.dashed} />
          })}
          {/* Wall·E ↔ Friday horizontal bidirectional arrow */}
        </svg>

        {/* Todd label at top centre */}
        <div style={{
          position: 'absolute',
          left: pos['Todd'].cx - 50,
          top: pos['Todd'].cy,
          width: 100,
          textAlign: 'center',
          color: '#c4b5fd',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          padding: '6px 12px',
          background: '#1e0b40',
          border: '1px solid #7c3aed44',
          borderRadius: 8,
        }}>
          👤 Todd
        </div>

        {/* Agent cards */}
        {Object.entries(pos).filter(([name]) => name !== 'Todd').map(([name, p]) => {
          const PLANNED_META = {
            'Mini-2':  { role: 'GYC-Growth-Claw · M3 Client Engine',       node: 'Mac Mini #2 (planned)' },
            'Thrawn':   { role: 'Business Intelligence',                     node: 'Mac Mini (live)' },
            'Monday':  { role: 'M3 Client Dashboard',                       node: 'Mac Mini #2 (planned)' },
            'Scribe':  { role: 'Report + Document Generation',              node: 'Mac Mini #2 (planned)' },
            'Arbiter': { role: 'Escalation + Inter-Agent Routing',          node: 'Mac Mini #2 (planned)' },
            'Friday':  { role: 'Laptop Orchestrator',                       node: 'Laptop (pending)' },
            'Chopper': { role: 'Friday Worker',                             node: 'Laptop (pending)' },
          }
          const pm = PLANNED_META[name] || { role: p.note || '—', node: '—' }
          const agent = agentByName[name] || { name, role: pm.role, node: pm.node, status: 'planned', category: 'planned', currentTask: null }
          const w = CARD_W[p.size || 'md'] || 152
          return (
            <div key={name} style={{ position: 'absolute', left: p.cx - w/2, top: p.cy }}>
              <AgentCard agent={agent} size={p.size || 'md'} />
              {p.note && !agentByName[name] && (
                <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 10, marginTop: 4 }}>{p.note}</div>
              )}
              {p.note && agentByName[name] && (
                <div style={{ textAlign: 'center', color: '#4f46e5', fontSize: 10, marginTop: 4 }}>{p.note}</div>
              )}
            </div>
          )
        })}


      </div>
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <section className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export default function MissionControlPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('overview')
  const [selectedTask, setSelectedTask] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/mission-control/overview', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load mission control')
      setData(json)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const allTasks = useMemo(() => {
    const cols = data?.taskBoard?.columns || {}
    return Object.entries(cols).flatMap(([status, items]) => (items || []).map((item) => ({ ...item, column: status })))
  }, [data])

  const jobs = useMemo(() => (data?.jobs || []).slice(0, 200), [data])
  const diary = useMemo(() => (data?.diary || []).slice(0, 400), [data])

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="rounded-[28px] border border-[var(--brand-border)] bg-[radial-gradient(circle_at_top,#35104d,transparent_38%),linear-gradient(180deg,rgba(20,12,26,0.98),rgba(10,10,10,1))] p-8 shadow-[0_0_60px_rgba(52,11,103,0.25)]">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-violet-300">Mission Control</div>
        <h1 className="mt-2 text-3xl font-bold text-white">🛰️ GYC Operating System</h1>
        <p className="mt-2 text-sm text-gray-300">Understand what is done, what is running, what is at risk, and what happens next.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ['overview', 'Overview'],
            ['agents', 'Agents'],
            ['tasks', 'Task Board'],
            ['jobs', 'Jobs History'],
            ['diary', 'Daily Diary (90d)'],
            ['links', 'Project Links'],
            ['schedule', 'Scheduler'],
            ['risk', 'Escalation Radar'],
            ['cost', 'Cost'],
            ['ideas', '💡 Idea Board'],
            ['brand', '🏢 Brand Guide'],
            ['intel', '🔭 Fulcrum Intel'],
            ['health', '🏥 Client Health'],
            ['log', '📋 Agent Log'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${tab === key ? 'border-violet-500/40 bg-violet-500/15 text-violet-100' : 'border-[var(--brand-border)] bg-black/20 text-gray-300 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
          <button onClick={load} className="ml-auto rounded-xl border border-[var(--brand-border)] px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white">Refresh</button>
        </div>
        {error ? <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title="Now">
            <div className="space-y-2 text-sm">
              <div className="text-gray-300">In Progress Tasks: <span className="text-white font-semibold">{(data?.taskBoard?.columns?.inProgress || []).length}</span></div>
              <div className="text-gray-300">Open Risk Clients: <span className="text-white font-semibold">{(data?.escalationRadar || []).filter((r) => r.riskBand === 'high').length}</span></div>
              <div className="text-gray-300">Eve Sources Healthy: <span className="text-white font-semibold">{(data?.eveSync || []).filter((s) => s.status === 'success').length}/{(data?.eveSync || []).length}</span></div>
            </div>
          </Panel>
          <Panel title="Top Blockers">
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-200">
              {(data?.scheduler || []).filter((s) => s.status !== 'ok').slice(0, 4).map((s) => <li key={s.id}>{s.finding}</li>)}
            </ul>
          </Panel>
          <Panel title="Today’s Focus">
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-200">
              {(data?.taskBoard?.columns?.inProgress || []).map((t) => <li key={t.id}>{t.title}</li>)}
            </ul>
          </Panel>
        </div>
      )}

      {tab === 'agents' && (
        <Panel title="Agent Fleet">

          {/* Fleet description */}
          <div className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-5 mb-6">
            <div className="flex flex-wrap gap-4 items-start justify-between">
              <div className="max-w-2xl">
                <div className="text-xs font-semibold uppercase tracking-widest text-violet-300 mb-1">The GYC AI Network</div>
                <p className="text-white font-semibold text-base mb-2">A coordinated fleet of specialized AI agents operating 24/7 to grow GYC.</p>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Each agent has a defined role, a dedicated workspace, and a chain of command. Together they handle data intelligence, 
                  build automation, call analysis, security monitoring, and client service delivery — while Wall·E orchestrates strategy 
                  and keeps Todd informed. As GYC scales into M3, this fleet scales with it.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 shrink-0">
                {[
                  { label: 'Live Agents', value: `${(data?.agents || []).filter(a => a.status !== 'planned').length}`, color: '#34d399' },
                  { label: 'Planned', value: `${(data?.agents || []).filter(a => a.status === 'planned').length}`, color: '#60a5fa' },
                  { label: 'Nodes Active', value: '2', color: '#AE2BCF' },
                  { label: 'Nodes Planned', value: '2', color: '#374151' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg border border-[var(--brand-border)] bg-black/20 px-4 py-3 text-center">
                    <div style={{ color }} className="text-2xl font-bold">{value}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 uppercase tracking-wider">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Node breakdown */}
            <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { name: 'GYC-Integrator-Claw', type: 'Mac Mini (2024)', status: 'live', agents: 'Wall·E, Yoda, R2, Thrawn, Soundwave, Echo, C3PO, Ratchet (all reporting to Wall·E)', color: '#7c3aed' },
                { name: 'GYC-Data-Claw', type: 'Mac Studio (M2 Max)', status: 'live', agents: 'Eve, BB-8, Fulcrum, Vision', color: '#0891b2' },
                { name: 'Laptop', type: 'Portable Node', status: 'pending', agents: 'Friday, Chopper', color: '#374151' },
                { name: 'GYC-Growth-Claw', type: 'Mac Mini #2 (planned)', status: 'planned', agents: 'Monday, Scribe, Arbiter', color: '#374151' },
              ].map(({ name, type, status, agents, color }) => (
                <div key={name} className="rounded-lg border border-[var(--brand-border)] bg-black/20 p-3"
                  style={{ borderLeftWidth: 3, borderLeftColor: color, borderLeftStyle: 'solid' }}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-white text-xs font-bold">{name}</div>
                    <span className={`text-[10px] rounded-full px-2 py-0.5 font-semibold ${status === 'live' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gray-700 text-gray-400'}`}>
                      {status === 'live' ? '● Live' : '○ Planned'}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 mb-1">{type}</div>
                  <div className="text-[11px] text-gray-400">{agents}</div>
                </div>
              ))}
            </div>
          </div>

          <AgentOrgChart agents={data?.agents || []} />
        </Panel>
      )}

      {tab === 'tasks' && (
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Panel title="Task Board">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(data?.taskBoard?.columns || {}).sort(([a], [b]) => {
                const order = ['backlog', 'inProgress', 'review', 'done']
                return (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99)
              }).map(([column, items]) => (
                <div key={column} className="rounded-xl border border-[var(--brand-border)] bg-black/20 p-3">
                  <div className="text-xs uppercase tracking-wider text-violet-300">
                    {{ backlog: 'Backlog', inProgress: 'In Progress', review: 'Review', done: 'Done' }[column] || column}
                  </div>
                  <div className="mt-2 space-y-2">
                    {(items || []).map((item) => (
                      <button key={item.id} onClick={() => setSelectedTask(item)} className="w-full rounded-lg border border-[var(--brand-border)] bg-black/30 p-2 text-left">
                        <div className="text-sm text-white">{item.title}</div>
                        <div className="mt-1 text-xs text-gray-400">{item.owner} • {item.priority}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Task Detail">
            {!selectedTask ? <div className="text-sm text-gray-400">Select a task to see detail and next steps.</div> : (
              <div className="space-y-3 text-sm">
                <div className="text-white font-semibold">{selectedTask.title}</div>
                <div className="text-gray-300">{selectedTask.description || 'No description yet.'}</div>
                <div className="text-xs text-gray-400">Owner: {selectedTask.owner} • Priority: {selectedTask.priority} • Project: {selectedTask.project || '—'}</div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500">Next Steps</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-gray-200">
                    {(selectedTask.nextSteps || []).map((step) => <li key={step}>{step}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}

      {tab === 'jobs' && (
        <Panel title="Past Jobs (90d view)">
          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="text-white">{job.title}</div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${job.status === 'success' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200'}`}>{job.status}</span>
                </div>
                <div className="mt-1 text-gray-300">{job.summary}</div>
                <div className="mt-1 text-xs text-gray-500">{fmtIso(job.startedAt)} → {fmtIso(job.endedAt)} • Owner: {job.owner}</div>
                {job.artifact ? <a href={job.artifact} className="mt-2 inline-block text-xs text-violet-300 hover:text-violet-200">Open artifact ↗</a> : null}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'diary' && (
        <Panel title="Daily Diary (Everything, 90 days)">
          <div className="max-h-[70vh] space-y-2 overflow-auto pr-1">
            {diary.map((entry, idx) => (
              <div key={`${entry.date}-${entry.time}-${idx}`} className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-3 text-sm">
                <div className="text-xs text-gray-500">{entry.date} • {entry.time}</div>
                <div className="mt-1 text-gray-200">{entry.note}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'links' && (
        <Panel title="Production Links (Projects)">
          <div className="grid gap-3 md:grid-cols-2">
            {(data?.projectLinks || []).map((link) => (
              <a key={link.url} href={link.url} className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-3 text-sm hover:border-violet-500/40 hover:bg-violet-500/10">
                <div className="text-white">{link.name}</div>
                <div className="mt-1 text-xs text-gray-400">{link.domain} • {link.status}</div>
                <div className="mt-2 text-xs text-violet-300">{link.url}</div>
              </a>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'schedule' && (
        <Panel title="Scheduler View">
          <div className="grid gap-3 md:grid-cols-1 xl:grid-cols-3">
            {(data?.scheduler || []).map((job) => (
              <div key={job.id} className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-white">{job.id}</div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${job.status === 'ok' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200'}`}>{job.status}</span>
                </div>
                <div className="text-gray-400">{job.cadence}</div>
                <div className="mt-2 text-xs text-violet-200">Last check: {fmtEpoch(job.lastCheckEpoch)}</div>
                <div className="mt-3 rounded-lg border border-[var(--brand-border)] bg-black/20 p-2">
                  <div className="text-[11px] uppercase tracking-wider text-gray-500">What we learned</div>
                  <div className="mt-1 text-gray-200">{job.finding || 'No finding recorded.'}</div>
                </div>
                <div className="mt-2 rounded-lg border border-[var(--brand-border)] bg-black/20 p-2">
                  <div className="text-[11px] uppercase tracking-wider text-gray-500">Follow-up</div>
                  <div className="mt-1 text-gray-200">{job.followUp || 'None.'}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === 'risk' && (
        <Panel title="Escalation Radar (Multifactor)">
          <div className="space-y-2">
            {(data?.escalationRadar || []).length ? data.escalationRadar.map((r) => (
              <div key={r.orgId} className="rounded-xl border border-[var(--brand-border)] bg-black/30 px-3 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-white">{r.orgName || r.orgId}</div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${r.riskBand === 'high' ? 'bg-rose-500/20 text-rose-200' : r.riskBand === 'medium' ? 'bg-amber-500/20 text-amber-200' : 'bg-emerald-500/20 text-emerald-200'}`}>{r.riskBand} risk</span>
                    <span className="text-violet-200">Score: {r.riskScore}</span>
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-400">Open tickets: {r.openCount} • Acronym: {r.acronym || 'n/a'}</div>
                {Array.isArray(r.flags) && r.flags.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.flags.slice(0, 4).map((f) => <span key={f} className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">{f}</span>)}
                  </div>
                ) : null}
              </div>
            )) : <div className="text-sm text-gray-400">No escalation rows found yet.</div>}
          </div>
        </Panel>
      )}

      {tab === 'cost' && (
        <Panel title="Cost Monitor">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-3 text-sm">
              <div className="text-white">Monthly Budget</div>
              <div className="mt-1 text-violet-200">${data?.costMonitor?.budgetMonthly ?? 200}</div>
              <div className="mt-1 text-xs text-gray-400">Thresholds: {(data?.costMonitor?.thresholds || []).join(', ')}</div>
            </div>
            <div className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-3 text-sm">
              <div className="text-white">Anthropic MTD</div>
              <div className="mt-1 text-rose-200">${Number(data?.costMonitor?.anthropic?.mtdUsd || 0).toFixed(2)}</div>
              <div className="mt-1 text-xs text-gray-400">Live via cost_report API</div>
            </div>
            <div className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-3 text-sm">
              <div className="text-white">Daily Run Rate</div>
              <div className="mt-1 text-amber-200">${Number(data?.costMonitor?.anthropic?.runRateDaily || 0).toFixed(2)}/day</div>
              <div className="mt-1 text-xs text-gray-400">Projected month-end based on current pace</div>
            </div>
            <div className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-3 text-sm">
              <div className="text-white">Projected Month-End</div>
              <div className="mt-1 text-amber-200">${Number(data?.costMonitor?.anthropic?.projectedMonthEndUsd || 0).toFixed(2)}</div>
              <div className="mt-1 text-xs text-gray-400">{data?.costMonitor?.note || 'Cost feed pending.'}</div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            {Number(data?.costMonitor?.anthropic?.mtdUsd || 0) > Number(data?.costMonitor?.budgetMonthly || 200)
              ? 'Budget alert: spend is above monthly target. Sonnet-first + explicit Opus approval guardrails are now active.'
              : 'Spend is within monthly budget threshold right now.'}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-3 text-sm">
              <div className="text-white">Active Routing Policy</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-200">
                <li>Default model: <span className="text-violet-200">{data?.costMonitor?.policy?.defaultModelPolicy || 'sonnet'}</span></li>
                <li>Opus: <span className="text-violet-200">explicit approval required</span></li>
                <li>Threshold guardrails: {Object.keys(data?.costMonitor?.policy?.thresholdGuardrails || {}).join(', ')}</li>
              </ul>
            </div>
            <div className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-3 text-sm">
              <div className="text-white">Thresholds Crossed</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(data?.costMonitor?.thresholdsCrossed || []).length
                  ? data.costMonitor.thresholdsCrossed.map((t) => <span key={t} className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-200">${t}</span>)
                  : <span className="text-gray-400">None</span>}
              </div>
            </div>
          </div>
        </Panel>
      )}

      {tab === 'ideas' && <IdeaBoard />}
      {tab === 'brand' && <BrandGuide />}
      {tab === 'intel' && <FulcrumIntel />}
      {tab === 'health' && <ClientHealthMonitor />}
      {tab === 'log' && <AgentEventLog />}
    </div>
  )
}

// ─── Idea Board ───────────────────────────────────────────────────────────────
const CATEGORIES = ['product', 'automation', 'integration', 'infrastructure', 'ops', 'other']
const STATUSES   = ['backlog', 'in-progress', 'blocked', 'done', 'archived']
const PRIORITIES = ['high', 'medium', 'low']

const STATUS_STYLE = {
  backlog:     'border-violet-500/30 bg-violet-500/10 text-violet-200',
  'in-progress':'border-amber-500/30 bg-amber-500/10 text-amber-200',
  blocked:     'border-rose-500/30 bg-rose-500/10 text-rose-200',
  done:        'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  archived:    'border-gray-600/30 bg-gray-600/10 text-gray-500',
}
const PRIORITY_STYLE = {
  high:   'text-rose-300',
  medium: 'text-amber-300',
  low:    'text-gray-400',
}
const PRIORITY_DOT = {
  high:   '#f87171',
  medium: '#fbbf24',
  low:    '#6b7280',
}
const CATEGORY_EMOJI = {
  product:        '🧩',
  automation:     '⚡',
  integration:    '🔌',
  infrastructure: '🖥️',
  ops:            '⚙️',
  other:          '💬',
}

function IdeaCard({ idea, onVote, onStatusChange, onArchive, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  if (idea.status === 'archived') return null

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-4 space-y-2 hover:border-violet-500/30 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className="mt-0.5 shrink-0 text-base">{CATEGORY_EMOJI[idea.category] || '💬'}</span>
          <div className="min-w-0">
            <button onClick={() => setExpanded((e) => !e)} className="text-left text-sm font-semibold text-white hover:text-violet-300 transition">
              {idea.title}
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${STATUS_STYLE[idea.status] || STATUS_STYLE.backlog}`}>
                {idea.status}
              </span>
              <span className={`text-[11px] font-semibold uppercase ${PRIORITY_STYLE[idea.priority] || ''}`}>
                ● {idea.priority}
              </span>
              <span className="text-[11px] text-gray-500 capitalize">{idea.category}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onVote(idea.id)}
            className="flex items-center gap-1 rounded-lg border border-[var(--brand-border)] px-2 py-1 text-xs text-gray-300 hover:border-violet-500/40 hover:text-violet-200 transition"
            title="Upvote"
          >
            👍 {idea.votes || 0}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="pt-1 space-y-3">
          {idea.description && <p className="text-sm text-gray-300">{idea.description}</p>}
          {idea.blockedBy && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              🚧 Blocked: {idea.blockedBy}
            </div>
          )}
          {idea.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {idea.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-[var(--brand-border)] bg-black/30 px-2 py-0.5 text-[11px] text-gray-400">#{tag}</span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <select
              value={idea.status}
              onChange={(e) => onStatusChange(idea.id, e.target.value)}
              className="rounded-lg border border-[var(--brand-border)] bg-black/40 px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-violet-500/40"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={() => onArchive(idea.id)}
              className="rounded-lg border border-[var(--brand-border)] px-3 py-1 text-xs text-gray-400 hover:border-amber-500/30 hover:text-amber-200 transition"
            >
              Archive
            </button>
            <button
              onClick={() => onDelete(idea.id)}
              className="rounded-lg border border-rose-500/20 px-3 py-1 text-xs text-rose-400 hover:bg-rose-500/10 transition"
            >
              Delete
            </button>
          </div>
          <p className="text-[11px] text-gray-600">Added by {idea.addedBy} · {new Date(idea.addedAt).toLocaleDateString()}</p>
        </div>
      )}
    </div>
  )
}

function IdeaBoard() {
  const [ideas, setIdeas]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [sortBy, setSortBy]       = useState('votes')
  const [showAdd, setShowAdd]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({
    title: '', description: '', category: 'product', priority: 'medium', tags: '', blockedBy: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/mission-control/ideas')
      const json = await res.json()
      setIdeas(json.ideas || [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function apiCall(body) {
    const res = await fetch('/api/mission-control/ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return res.json()
  }

  async function handleVote(id) {
    await apiCall({ action: 'vote', id })
    setIdeas((prev) => prev.map((i) => i.id === id ? { ...i, votes: (i.votes || 0) + 1 } : i))
  }

  async function handleStatusChange(id, value) {
    await apiCall({ action: 'update_status', id, value })
    setIdeas((prev) => prev.map((i) => i.id === id ? { ...i, status: value } : i))
  }

  async function handleArchive(id) {
    await apiCall({ action: 'archive', id })
    setIdeas((prev) => prev.map((i) => i.id === id ? { ...i, status: 'archived' } : i))
  }

  async function handleDelete(id) {
    if (!confirm('Delete this idea?')) return
    await apiCall({ action: 'delete', id })
    setIdeas((prev) => prev.filter((i) => i.id !== id))
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    const res = await apiCall({
      action: 'add',
      idea: {
        ...form,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        addedBy: 'Todd',
      },
    })
    if (res.ok) {
      setIdeas((prev) => [res.idea, ...prev])
      setForm({ title: '', description: '', category: 'product', priority: 'medium', tags: '', blockedBy: '' })
      setShowAdd(false)
    }
    setSaving(false)
  }

  const visible = ideas
    .filter((i) => i.status !== 'archived')
    .filter((i) => filter === 'all' || i.status === filter || i.category === filter || i.priority === filter)
    .sort((a, b) => {
      if (sortBy === 'votes') return (b.votes || 0) - (a.votes || 0)
      if (sortBy === 'priority') return PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)
      if (sortBy === 'newest') return new Date(b.addedAt) - new Date(a.addedAt)
      return 0
    })

  const counts = { total: ideas.filter((i) => i.status !== 'archived').length }
  STATUSES.filter((s) => s !== 'archived').forEach((s) => { counts[s] = ideas.filter((i) => i.status === s).length })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">💡 Idea Board</h2>
          <p className="text-sm text-gray-400 mt-0.5">Future projects, features, and experiments — park ideas here, vote, and promote to the task board when ready.</p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-100 hover:bg-violet-500/25 transition"
        >
          + Add Idea
        </button>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {[['all', `All (${counts.total})`], ...STATUSES.filter((s) => s !== 'archived').map((s) => [s, `${s} (${counts[s] || 0})`])].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition ${filter === key ? 'border-violet-500/40 bg-violet-500/15 text-violet-100' : 'border-[var(--brand-border)] bg-black/20 text-gray-400 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-500">Sort:</span>
          {[['votes','Votes'],['priority','Priority'],['newest','Newest']].map(([key,label]) => (
            <button key={key} onClick={() => setSortBy(key)}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${sortBy === key ? 'border-violet-500/40 text-violet-200' : 'border-[var(--brand-border)] text-gray-500 hover:text-gray-300'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
          <p className="text-sm font-semibold text-violet-200">New Idea</p>
          <input
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Title *"
            className="w-full rounded-lg border border-[var(--brand-border)] bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)"
            rows={2}
            className="w-full rounded-lg border border-[var(--brand-border)] bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Category</label>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded-lg border border-[var(--brand-border)] bg-black/40 px-2 py-1.5 text-sm text-gray-300 focus:outline-none">
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_EMOJI[c]} {c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Priority</label>
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="w-full rounded-lg border border-[var(--brand-border)] bg-black/40 px-2 py-1.5 text-sm text-gray-300 focus:outline-none">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <input
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="Tags (comma-separated, e.g. sales, ai, ghl)"
            className="w-full rounded-lg border border-[var(--brand-border)] bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
          />
          <input
            value={form.blockedBy}
            onChange={(e) => setForm((f) => ({ ...f, blockedBy: e.target.value }))}
            placeholder="Blocked by (optional)"
            className="w-full rounded-lg border border-[var(--brand-border)] bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-1.5 text-sm font-medium text-violet-100 hover:bg-violet-500/25 transition disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Idea'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="rounded-xl border border-[var(--brand-border)] px-4 py-1.5 text-sm text-gray-400 hover:text-white transition">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Idea cards */}
      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading ideas…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-5 py-10 text-center text-sm text-gray-500">
          No ideas match that filter. <button onClick={() => setFilter('all')} className="text-violet-300 underline">Show all</button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onVote={handleVote}
              onStatusChange={handleStatusChange}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
