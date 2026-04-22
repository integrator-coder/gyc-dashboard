'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import BrandGuide from '@/components/BrandGuide'
import FulcrumIntel from '@/components/FulcrumIntel'
import ClientHealthMonitor from '@/components/ClientHealthMonitor'
import AgentEventLog from '@/components/AgentEventLog'
import ZoomClassifierPage from '@/components/ZoomClassifierPage'

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
  'R2':      ['Building specialist — all code on Mac Mini', 'Reports to Echo (complex builds) or Wall·E (simple/urgent direct)', 'Executes: features, scripts, API integrations, bug fixes', 'Always returns: changed files, commit hash, build result, live verification', 'Never reports done without proof of completion'],
  'Yoda':  ['Reserved for deep analysis requiring maximum reasoning depth', 'Handles complex multi-variable decisions and long-form synthesis', 'Engaged sparingly — highest cost model, highest quality output', 'Wall·E escalates to Yoda when standard reasoning is insufficient', 'Strategic advisory layer — never for routine tasks'],
  'Thrawn':   ['Division Lead — Business Intelligence', 'Manages: Soundwave (call analysis), Ratchet (fleet watchdog)', 'Detects churn risk, billing failures, at-risk client signals, upsell opportunities', 'Consolidates Soundwave + Ratchet outputs before escalating to Wall·E', 'Reports every 4 hours — the CMO-level radar and division coordinator'],
  'Soundwave':    ['Call analysis specialist — Tier 2 under Thrawn', 'Processes Zoom sales and GA call transcripts daily', 'Scores rep performance: talk/listen ratio, objection handling, close technique', 'Writes per-rep coaching notes — reports findings to Thrawn', 'Thrawn consolidates before escalating to Wall·E'],
  'Echo':    ['Division Lead — Operations & Delivery', 'Manages: R2 (Builder), C3PO (QA)', 'Owns all complex builds (2+ files): spec → R2 → C3PO → proof → report', 'Reports consolidated summaries to Wall·E every 4 hours', 'The delivery chain — nothing ships without Echo confirming C3PO sign-off'],
  'C3PO':   ['QA validation specialist — Tier 2 under Echo', 'Validates all builds before shipping — reports to Echo', 'Runs build checks, smoke tests, regression scans on new code', 'Returns explicit pass/fail verdict with test evidence', 'Nothing ships without C3PO sign-off — the release gate'],
  'Morpheus': ['Memory Dreaming specialist — Tier 2 under Yoda', 'Runs nightly memory consolidation across the fleet', 'Promotes significant decisions and patterns to MEMORY.md', 'Reports memory health weekly to Yoda', 'The fleet memory keeper — ensures continuity across sessions'],
    'Ratchet': ['Fleet watchdog specialist — Tier 2 under Thrawn', 'Monitors heartbeat and status of every agent in the fleet', 'Scans cron job history for errors, missed runs, degraded patterns', 'Reports anomalies to Thrawn immediately; critical failures go direct to Wall·E', 'The fleet immune system — catches problems before Todd ever notices'],
  'BB-8':    ['Eve\'s dedicated coding agent running on Mac Studio', 'Builds and maintains all sync scripts, pipeline jobs, and Eve-side tooling', 'Handles Mac Studio automations and data transformation scripts', 'Works in concert with Eve — BB-8 builds the tools that Eve runs', 'Mirrors R2\'s role but scoped entirely to the data infrastructure layer'],
  'Fulcrum': ['Researches the external landscape: competitors, industry trends, best practices', 'Produces structured research memos with evidence and GYC-specific implications', 'Covers: childcare marketing, AI tooling, sales benchmarks, growth playbooks', 'Rotates through topic library on a defined cadence — no topic goes stale', 'The strategic antenna — keeps GYC\'s knowledge current with what\'s happening outside'],
  'Vision':  ['Runs scheduled security posture audits on both Mac Mini and Mac Studio', 'Validates snapshot freshness — ensures no dashboard is ever showing stale data', 'Monitors for anomalous processes, failed auth attempts, or unexpected changes', 'Detects data integrity issues: mismatched counts, broken syncs, schema drift', 'The security and data quality enforcer — silent until something is wrong'],
  'Friday':  ['Laptop-based orchestrator for remote and travel operations (planned)', 'Manages a lightweight agent cluster when Todd is away from base nodes', 'Handles mobile-first interactions and time-sensitive routing decisions', 'Coordinates handoff with Wall·E when returning to base', 'Ensures GYC operations continue uninterrupted regardless of Todd\'s location'],
  'Chopper': ['Friday\'s execution worker running on the laptop node (planned)', 'Handles lightweight task execution in remote and travel contexts', 'Runs scripts, lookups, and quick responses under Friday\'s direction', 'Built lean and fast for laptop hardware constraints', 'The mobile utility agent — reliable and low-resource on the go'],
  'Monday':  ['Serves all client-facing M3 dashboard reads for external tenants (planned)', 'Handles per-client data requests filtered strictly by tenant ID', 'Isolates client-portal query load completely from internal GYC ops', 'Manages M3 caching, refresh cycles, and client-specific data views', 'Eve writes the data in — Monday serves it out to GYC\'s paying clients'],
  'Scribe':  ['Generates client-facing monthly performance reports and GA summaries (planned)', 'Writes structured proposals, meeting prep documents, and deliverables on demand', 'Transforms raw Neon data into readable, branded client-facing language', 'Runs Growth Advisor meeting briefs and post-meeting follow-up summaries', 'Turns the AI network\'s intelligence into polished human-readable output'],
  'Arbiter': ['Manages inter-agent routing and task escalation at scale (planned)', 'Dispatches incoming tasks to the correct agent based on routing rules', 'Handles escalation chains when agents flag unresolved or blocked issues', 'Maintains and updates the routing rules table under Wall·E\'s direction', 'As the fleet grows to serve external M3 clients, Arbiter becomes the load balancer'],
}

const COMMAND_MODES = [
  {
    name: 'Parking Lot',
    accent: 'amber',
    definition: 'Capture ideas, don’t build.',
    note: 'Use when something matters, but it is not approved for execution yet.',
  },
  {
    name: 'Active Queue',
    accent: 'violet',
    definition: 'Approved items keep moving in the background while we talk.',
    note: 'Best default when Todd wants progress without derailing the current conversation.',
  },
  {
    name: 'Hold / Pause',
    accent: 'slate',
    definition: 'Stop execution, discuss only.',
    note: 'Use when the goal is clarification, review, or risk reduction before more work happens.',
  },
  {
    name: 'Build Now',
    accent: 'emerald',
    definition: 'Execute immediately.',
    note: 'Use when the task is approved and speed matters more than queueing it.',
  },
]

const COMMAND_LIBRARY = [
  {
    phrase: 'build this now',
    description: 'Start the work immediately instead of parking it or queuing it.',
  },
  {
    phrase: 'send R2',
    description: 'Route the build to R2 so implementation work starts with the builder agent.',
  },
  {
    phrase: 'hold',
    description: 'Pause execution and switch into discussion or review mode.',
  },
  {
    phrase: 'parking lot',
    description: 'Capture the idea so it is remembered, but do not build it yet.',
  },
  {
    phrase: 'queue this',
    description: 'Add the item to approved work that can continue in the background.',
  },
  {
    phrase: 'approve for background',
    description: 'Explicitly allow the work to keep moving while Todd and Wall·E keep talking.',
  },
  {
    phrase: 'stop current work',
    description: 'Interrupt the active task and halt execution until further direction.',
  },
  {
    phrase: 'what is R2 working on?',
    description: 'Ask for the builder’s current task, so Todd can quickly re-orient.',
  },
  {
    phrase: 'show queue',
    description: 'Show what is currently approved, active, or waiting in the system.',
  },
  {
    phrase: 'what’s blocked?',
    description: 'Surface anything stalled, waiting, or needing a decision.',
  },
]

const COMMAND_ACCENT_STYLES = {
  amber: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-200',
    chip: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  },
  violet: {
    border: 'border-violet-500/30',
    bg: 'bg-violet-500/10',
    text: 'text-violet-200',
    chip: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
  },
  slate: {
    border: 'border-slate-500/30',
    bg: 'bg-slate-500/10',
    text: 'text-slate-200',
    chip: 'border-slate-500/30 bg-slate-500/10 text-slate-200',
  },
  emerald: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-200',
    chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  },
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
  const XH = 260, MH = 210, SH = 200, GAP = 110
  const R0 = 0
  const R1 = 60
  const R2 = R1 + XH + GAP    // 370
  const R3 = R2 + SH + GAP    // 635
  const R4 = R3 + SH + GAP    // 900
  const R5 = R4 + SH + GAP    // 1165
  const R6 = R5 + SH + GAP    // 1430

  const COL = { A: 100, B: 360, C: 640, D: 920, E: 1210 }
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
    'Morpheus':  { cx: COL.B,   cy: R4, size: 'sm' },
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
            'Yoda':    { role: 'Division Lead — Analysis & Architecture',   node: 'Mac Mini (live)' },
            'Thrawn':   { role: 'Division Lead — Business Intelligence',     node: 'Mac Mini (live)' },
            'Echo':    { role: 'Division Lead — Operations & Delivery',     node: 'Mac Mini (live)' },
            'Morpheus': { role: 'Memory Dreaming — reports to Yoda',        node: 'Mac Mini (live)' },
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

function Panel({ title, children, action }) {
  return (
    <section className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {action && <div>{action}</div>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function CopyCommandButton({ text }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-lg border border-[var(--brand-border)] px-2.5 py-1 text-[11px] font-semibold text-gray-300 transition hover:border-violet-500/40 hover:text-violet-100"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function CommandPanelSection({ status, onJump }) {
  const currentModeStyle = COMMAND_MODES.find((mode) => mode.name === status.currentMode)
  const currentModeAccent = COMMAND_ACCENT_STYLES[currentModeStyle?.accent || 'violet']

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-500/30 bg-[radial-gradient(circle_at_top_left,rgba(115,20,148,0.22),transparent_40%),linear-gradient(180deg,rgba(18,9,29,0.98),rgba(7,7,10,1))] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">Todd Command Panel</div>
            <h2 className="mt-2 text-2xl font-bold text-white">Reference, status, and quick language for driving Mission Control</h2>
            <p className="mt-2 text-sm text-gray-300">This is a practical v1 command surface, strong as a memory aid now, without pretending it already controls runtime state directly.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onJump('tasks')}
              className="rounded-xl border border-violet-500/40 bg-violet-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-violet-100 transition hover:bg-violet-500/25"
            >
              Open Task Board
            </button>
            <button
              onClick={() => onJump('agents')}
              className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-300 transition hover:text-white"
            >
              Check Agents
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white">Live Status / Memory Aids</div>
              <div className="mt-1 text-xs text-gray-400">Pulled from existing Mission Control signals where available.</div>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${currentModeAccent.chip}`}>
              {status.currentMode}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Current Mode</div>
              <div className="mt-2 text-lg font-bold text-white">{status.currentMode}</div>
              <div className="mt-2 text-xs text-amber-200">Manual placeholder, derived from current board activity. Runtime mode is not persisted yet.</div>
            </div>

            <div className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Active Queue Summary</div>
              <div className="mt-2 text-lg font-bold text-white">{status.activeQueueCount} active item{status.activeQueueCount === 1 ? '' : 's'}</div>
              <div className="mt-2 text-xs text-gray-300">{status.inProgressCount} in progress, {status.reviewCount} in review, {status.backlogCount} in backlog.</div>
            </div>

            <div className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-4 md:col-span-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">What R2 Is Working On</div>
              <div className="mt-2 text-base font-semibold text-white">{status.r2Task}</div>
              <div className="mt-2 text-xs text-gray-400">Source: current Mission Control agent/task data.</div>
            </div>

            <div className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Waiting / Blocked</div>
              <div className="mt-2 text-lg font-bold text-white">{status.blockedItems.length}</div>
              <div className="mt-2 text-xs text-gray-300">Combines blocked board items and attention items from the scheduler.</div>
            </div>

            <div className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Parking Lot / Backlog</div>
              <div className="mt-2 text-lg font-bold text-white">{status.backlogCount}</div>
              <div className="mt-2 text-xs text-gray-300">Use this as the memory shelf for ideas that are captured, not building yet.</div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Queue Snapshot</div>
              <div className="mt-2 space-y-2">
                {status.queueItems.length ? status.queueItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[var(--brand-border)] bg-black/30 px-3 py-2">
                    <div className="text-sm text-white">{item.title}</div>
                    <div className="mt-1 text-[11px] text-gray-400">{item.owner || 'Unassigned'} • {item.columnLabel}</div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-3 py-4 text-sm text-gray-400">No active queue items visible right now.</div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Blocked Snapshot</div>
              <div className="mt-2 space-y-2">
                {status.blockedItems.length ? status.blockedItems.map((item, idx) => (
                  <div key={`${item.type}-${idx}`} className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                    <div className="text-sm text-white">{item.title}</div>
                    <div className="mt-1 text-[11px] text-amber-100/80">{item.detail}</div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-4 text-sm text-emerald-200">Nothing obviously blocked from the current task board or scheduler.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-5">
            <div className="text-lg font-semibold text-white">Operating Modes</div>
            <div className="mt-1 text-xs text-gray-400">Use these as the plain-language control states Todd can reference out loud.</div>
            <div className="mt-4 grid gap-3">
              {COMMAND_MODES.map((mode) => {
                const accent = COMMAND_ACCENT_STYLES[mode.accent]
                const active = status.currentMode === mode.name
                return (
                  <div key={mode.name} className={`rounded-xl border p-4 ${accent.border} ${accent.bg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className={`text-sm font-bold ${accent.text}`}>{mode.name}</div>
                        <div className="mt-1 text-sm text-white">{mode.definition}</div>
                      </div>
                      {active ? <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${accent.chip}`}>Current view</span> : null}
                    </div>
                    <div className="mt-2 text-xs text-gray-300">{mode.note}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--brand-border)] bg-black/20 p-5">
            <div className="text-lg font-semibold text-white">Useful Commands / Phrases</div>
            <div className="mt-1 text-xs text-gray-400">Shortcuts Todd can say naturally, without remembering rigid syntax.</div>
            <div className="mt-4 grid gap-3">
              {COMMAND_LIBRARY.map((command) => (
                <div key={command.phrase} className="rounded-xl border border-[var(--brand-border)] bg-black/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-violet-100">“{command.phrase}”</div>
                      <div className="mt-1 text-xs leading-5 text-gray-300">{command.description}</div>
                    </div>
                    <CopyCommandButton text={command.phrase} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Add Task Modal ────────────────────────────────────────────────────────
function AddTaskModal({ onClose, onSaved }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('To Do')
  const [priority, setPriority] = useState('Medium')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) { setErr('Title is required'); return }
    setSaving(true)
    setErr('')
    try {
      const res = await fetch('/api/mission-control/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, status, priority: priority.toLowerCase() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save')
      onSaved()
      onClose()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-violet-500/30 bg-[#0e0414] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-bold text-white">Add Task</div>
          <button onClick={onClose} className="text-gray-300 hover:text-white text-lg">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-gray-400 uppercase tracking-wider">Title *</label>
            <input
              className="w-full rounded-lg border border-violet-500/30 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-400 focus:outline-none"
              placeholder="Task title…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400 uppercase tracking-wider">Description</label>
            <textarea
              className="w-full rounded-lg border border-violet-500/30 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-400 focus:outline-none"
              placeholder="Optional details…"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400 uppercase tracking-wider">Status</label>
              <select
                className="w-full rounded-lg border border-violet-500/30 bg-black/40 px-3 py-2 text-sm text-white focus:border-violet-400 focus:outline-none"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option>To Do</option>
                <option>In Progress</option>
                <option>Blocked</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400 uppercase tracking-wider">Priority</label>
              <select
                className="w-full rounded-lg border border-violet-500/30 bg-black/40 px-3 py-2 text-sm text-white focus:border-violet-400 focus:outline-none"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
          </div>
          {err && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{err}</div>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-[var(--brand-border)] px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function MissionControlPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('overview')
  const [selectedTask, setSelectedTask] = useState(null)
  const [showAddTask, setShowAddTask] = useState(false)
  const [completingId, setCompletingId] = useState(null)

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

  const commandPanelStatus = useMemo(() => {
    const columns = data?.taskBoard?.columns || {}
    const inProgress = columns.inProgress || []
    const review = columns.review || []
    const backlog = columns.backlog || []
    const blocked = columns.blocked || []
    const schedulerAttention = (data?.scheduler || []).filter((item) => item.status !== 'ok')
    const r2Agent = (data?.agents || []).find((agent) => agent.name === 'R2')

    const currentMode = inProgress.length || review.length
      ? 'Active Queue'
      : backlog.length
        ? 'Parking Lot'
        : 'Hold / Pause'

    return {
      currentMode,
      activeQueueCount: inProgress.length + review.length,
      inProgressCount: inProgress.length,
      reviewCount: review.length,
      backlogCount: backlog.length,
      r2Task: r2Agent?.currentTask || 'No active R2 task is visible right now.',
      queueItems: [
        ...inProgress.map((item) => ({ ...item, columnLabel: 'In Progress' })),
        ...review.map((item) => ({ ...item, columnLabel: 'Review' })),
      ].slice(0, 6),
      blockedItems: [
        ...blocked.map((item) => ({
          type: 'task',
          title: item.title,
          detail: `${item.owner || 'Unassigned'} • Blocked task board item`,
        })),
        ...schedulerAttention.map((item) => ({
          type: 'scheduler',
          title: item.finding,
          detail: `${item.cadence} • ${item.followUp}`,
        })),
      ].slice(0, 6),
    }
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
            ['command', 'Command Panel'],
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
            ['calls', '📞 Call Intelligence'],
            ['quality', '🔬 Data Quality'],
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

      {tab === 'command' && (
        <CommandPanelSection status={commandPanelStatus} onJump={setTab} />
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
                    <div className="text-[11px] text-gray-300 mt-0.5 uppercase tracking-wider">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Node breakdown */}
            <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { name: 'GYC-Integrator-Claw', type: 'Mac Mini (2024)', status: 'live', agents: 'Wall·E, Yoda, R2, Thrawn, Soundwave, Echo, C3PO, Ratchet, Morpheus (all reporting to Wall·E)', color: '#7c3aed' },
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
                  <div className="text-[11px] text-gray-300 mb-1">{type}</div>
                  <div className="text-[11px] text-gray-400">{agents}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Fleet Hierarchy & Delegation Rules ─────────────────────── */}
          <div className="mb-8">
            <h2 style={{ color: '#731494', fontSize: 16, fontWeight: 700, marginBottom: 16, letterSpacing: '0.02em' }}>
              Fleet Hierarchy &amp; Delegation Rules
            </h2>

            {/* Hierarchy Visual */}
            <div style={{ background: '#0d0d1a', border: '1px solid #2a1a3e', borderRadius: 12, padding: '20px 24px', marginBottom: 16, overflowX: 'auto' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.8 }}>
                <div><span style={{ color: '#ffffff', fontWeight: 700 }}>Todd</span></div>
                <div><span style={{ color: '#ffffff' }}>{'  └── '}</span><span style={{ color: '#731494', fontWeight: 700 }}>Wall·E (Orchestrator)</span></div>
                <div><span style={{ color: '#ffffff' }}>{'        ├── '}</span><span style={{ color: '#C19C46', fontWeight: 600 }}>Yoda (Division Lead — Analysis &amp; Architecture)</span></div>
                <div><span style={{ color: '#ffffff' }}>{'        │     └── '}</span><span style={{ color: '#6b7280' }}>Morpheus (Memory Dreaming)</span></div>
                <div><span style={{ color: '#ffffff' }}>{'        ├── '}</span><span style={{ color: '#C19C46', fontWeight: 600 }}>Thrawn (Division Lead — Business Intelligence)</span></div>
                <div><span style={{ color: '#ffffff' }}>{'        │     ├── '}</span><span style={{ color: '#6b7280' }}>Soundwave (Call Analysis)</span></div>
                <div><span style={{ color: '#ffffff' }}>{'        │     └── '}</span><span style={{ color: '#6b7280' }}>Ratchet (Fleet Watchdog)</span></div>
                <div><span style={{ color: '#ffffff' }}>{'        ├── '}</span><span style={{ color: '#C19C46', fontWeight: 600 }}>Echo (Division Lead — Operations &amp; Delivery)</span></div>
                <div><span style={{ color: '#ffffff' }}>{'        │     ├── '}</span><span style={{ color: '#6b7280' }}>R2 (Builder)</span></div>
                <div><span style={{ color: '#ffffff' }}>{'        │     └── '}</span><span style={{ color: '#6b7280' }}>C3PO (QA Validation)</span></div>
                <div><span style={{ color: '#ffffff' }}>{'        └── '}</span><span style={{ color: '#C19C46', fontWeight: 600 }}>Eve (Mac Studio Node Lead)</span></div>
                <div><span style={{ color: '#ffffff' }}>{'              ├── '}</span><span style={{ color: '#6b7280' }}>BB-8 (Builder)</span></div>
                <div><span style={{ color: '#ffffff' }}>{'              ├── '}</span><span style={{ color: '#6b7280' }}>Fulcrum (Research)</span></div>
                <div><span style={{ color: '#ffffff' }}>{'              └── '}</span><span style={{ color: '#6b7280' }}>Vision (Security)</span></div>
              </div>
            </div>
            {/* Delegation Rules — 3 cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignItems: 'stretch' }}>
              {/* Card 1: How Tasks Flow */}
              <div style={{ background: '#0d0d1a', border: '1px solid #2a1a3e', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ color: '#731494', fontWeight: 700, fontSize: 13, marginBottom: 10, letterSpacing: '0.03em', textTransform: 'uppercase' }}>How Tasks Flow</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[
                    'Simple builds (1 file, urgent) → Wall·E → R2 directly',
                    'Complex builds (2+ files) → Wall·E → Echo → R2 → C3PO → ships',
                    'Analysis requests → Wall·E → Thrawn → (Soundwave/Ratchet if needed)',
                    'Deep review → Wall·E → Yoda',
                    "Research → Wall·E → Fulcrum (Eve's node)",
                  ].map((item, i) => (
                    <li key={i} style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.5, paddingLeft: 12, borderLeft: '2px solid #2a1a3e' }}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Card 2: Reporting Cadence */}
              <div style={{ background: '#0d0d1a', border: '1px solid #2a1a3e', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ color: '#731494', fontWeight: 700, fontSize: 13, marginBottom: 10, letterSpacing: '0.03em', textTransform: 'uppercase' }}>Reporting Cadence</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[
                    'Specialists report to their Division Lead',
                    'Division Leads consolidate and report to Wall·E every 4 hours',
                    'No skipping levels except genuine emergencies',
                    'Todd can speak directly to any agent at any time',
                    'If Todd gives an agent a task, that agent notifies Wall·E before executing anything on live systems',
                  ].map((item, i) => (
                    <li key={i} style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.5, paddingLeft: 12, borderLeft: '2px solid #2a1a3e' }}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Card 3: Proof Standard */}
              <div style={{ background: '#0d0d1a', border: '1px solid #2a1a3e', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ color: '#731494', fontWeight: 700, fontSize: 13, marginBottom: 10, letterSpacing: '0.03em', textTransform: 'uppercase' }}>Proof Standard</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[
                    'No task is "done" without proof',
                    'Builds: commit hash + build result + live verification',
                    'Analysis: structured memo with sources',
                    'QA: explicit pass/fail with test output',
                    'Division Leads do not report complete without proof from their specialists',
                  ].map((item, i) => (
                    <li key={i} style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.5, paddingLeft: 12, borderLeft: '2px solid #2a1a3e' }}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <AgentOrgChart agents={data?.agents || []} />
        </Panel>
      )}

      {showAddTask && <AddTaskModal onClose={() => setShowAddTask(false)} onSaved={load} />}

      {tab === 'tasks' && (
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Panel title="Task Board" action={
            <button
              onClick={() => setShowAddTask(true)}
              className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/25 transition"
            >
              + Add Task
            </button>
          }>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(data?.taskBoard?.columns || {}).sort(([a], [b]) => {
                const order = ['backlog', 'inProgress', 'review', 'done']
                return (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99)
              }).map(([column, items]) => (
                <div key={column} className="rounded-xl border border-[var(--brand-border)] bg-black/20 p-3">
                  <div className="text-xs uppercase tracking-wider text-violet-300">
                    {{ backlog: 'Backlog', inProgress: 'In Progress', review: 'Review', done: 'Done' }[column] || column}
                    <span className="ml-1.5 text-gray-300">({(items || []).length})</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {(items || []).map((item) => (
                      <div key={item.id} className="group relative rounded-lg border border-[var(--brand-border)] bg-black/30 p-2">
                        <button className="w-full text-left" onClick={() => setSelectedTask(item)}>
                          <div className="text-sm text-white pr-6">{item.title}</div>
                          <div className="mt-1 text-xs text-gray-400">{item.owner} • {item.priority}</div>
                        </button>
                        {column !== 'done' && (
                          <button
                            title="Mark as done"
                            disabled={completingId === item.id}
                            onClick={async (e) => {
                              e.stopPropagation()
                              setCompletingId(item.id)
                              try {
                                await fetch('/api/mission-control/tasks', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ taskId: item.id }),
                                })
                                await load()
                                setSelectedTask(null)
                              } finally {
                                setCompletingId(null)
                              }
                            }}
                            className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 opacity-0 group-hover:opacity-100 hover:bg-emerald-500/25 transition disabled:opacity-40"
                          >
                            {completingId === item.id ? '…' : '✓'}
                          </button>
                        )}
                        {column === 'done' && (
                          <span className="absolute top-2 right-2 text-emerald-500 text-xs">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Task Detail">
            {!selectedTask ? <div className="text-sm text-gray-400">Select a task to see detail and next steps.</div> : (
              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-white font-semibold">{selectedTask.title}</div>
                  {selectedTask.column !== 'done' && (
                    <button
                      disabled={completingId === selectedTask.id}
                      onClick={async () => {
                        setCompletingId(selectedTask.id)
                        try {
                          await fetch('/api/mission-control/tasks', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ taskId: selectedTask.id }),
                          })
                          await load()
                          setSelectedTask(null)
                        } finally {
                          setCompletingId(null)
                        }
                      }}
                      className="shrink-0 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40 transition"
                    >
                      {completingId === selectedTask.id ? 'Moving…' : '✓ Mark Done'}
                    </button>
                  )}
                </div>
                <div className="text-gray-300">{selectedTask.description || 'No description yet.'}</div>
                <div className="text-xs text-gray-400">Owner: {selectedTask.owner} • Priority: {selectedTask.priority} • Project: {selectedTask.project || '—'}</div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-300">Next Steps</div>
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
                <div className="mt-1 text-xs text-gray-300">{fmtIso(job.startedAt)} → {fmtIso(job.endedAt)} • Owner: {job.owner}</div>
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
                <div className="text-xs text-gray-300">{entry.date} • {entry.time}</div>
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

      {tab === 'schedule' && <SchedulerTab />}

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
          <DailyTokenChart />
          <div className="mt-6" />
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
      {tab === 'calls' && (
        <Panel title="📞 Call Intelligence">
          <p className="text-sm text-gray-400 mb-5">Classify Zoom calls, assign reps, and log activity to client and staff cards. Classifications write to ActivityLog for Phase 2 card wiring.</p>
          <ZoomClassifierPage embedded />
        </Panel>
      )}

      {tab === 'quality' && <DataQualityTab />}
    </div>
  )
}

// ─── Daily Token Usage Chart ────────────────────────────────────────────────
function fmtDate(dateStr) {
  // Shorten YYYY-MM-DD to M/D for axis labels
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return `${Number(parts[1])}/${Number(parts[2])}`
}

function fmtK(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function DailyTokenCustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0]?.payload || {}
  return (
    <div style={{
      background: '#0e0414',
      border: '1px solid #4a3060',
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 12,
      minWidth: 190,
    }}>
      <div style={{ color: '#c4b5fd', fontWeight: 700, marginBottom: 6 }}>{d.date || label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: '#60a5fa' }}>● Input (est.)</span>
          <span style={{ color: '#fff' }}>{fmtK(d.inputTokens || 0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: '#731494' }}>● Output (est.)</span>
          <span style={{ color: '#fff' }}>{fmtK(d.outputTokens || 0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: '#9ca3af' }}>● Cache (est.)</span>
          <span style={{ color: '#fff' }}>{fmtK(d.cacheTokens || 0)}</span>
        </div>
        <div style={{ borderTop: '1px solid #2a1a3e', marginTop: 4, paddingTop: 4, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: '#fbbf24' }}>Total (est.)</span>
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>{fmtK(d.totalTokens || 0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 2 }}>
          <span style={{ color: '#34d399' }}>Cost (actual)</span>
          <span style={{ color: '#34d399', fontWeight: 700 }}>${Number(d.estimatedCost || 0).toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

function DailyTokenChart() {
  const [chartData, setChartData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch('/api/mission-control/usage-daily', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setError(json.error); setLoading(false); return }
        setChartData(json.data || [])
        setLoading(false)
      })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 p-5">
        <div className="text-xs font-semibold uppercase tracking-widest text-violet-300 mb-1">Daily Token Usage</div>
        <div className="text-sm text-gray-400 py-8 text-center">Loading usage data…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5">
        <div className="text-xs font-semibold uppercase tracking-widest text-violet-300 mb-1">Daily Token Usage</div>
        <div className="text-sm text-rose-300">{error}</div>
      </div>
    )
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 p-5">
        <div className="text-xs font-semibold uppercase tracking-widest text-violet-300 mb-1">Daily Token Usage</div>
        <div className="text-sm text-gray-400 py-8 text-center">No usage data available yet.</div>
      </div>
    )
  }

  const totalCost = chartData.reduce((s, d) => s + (d.estimatedCost || 0), 0)
  const peakDay = chartData.reduce((best, d) => (d.estimatedCost > (best?.estimatedCost || 0) ? d : best), null)

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-violet-300 mb-0.5">Daily Token Usage</div>
          <div className="text-base font-bold text-white">AI Spend — Last 30 Days</div>
          <div className="text-xs text-gray-400 mt-0.5">Token counts are estimated from cost using Claude Sonnet pricing ratios</div>
        </div>
        <div className="flex gap-3">
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-300">${totalCost.toFixed(2)}</div>
            <div className="text-[11px] text-gray-400 uppercase tracking-wide">30d Total</div>
          </div>
          {peakDay && (
            <div className="text-center">
              <div className="text-lg font-bold text-amber-300">${Number(peakDay.estimatedCost).toFixed(2)}</div>
              <div className="text-[11px] text-gray-400 uppercase tracking-wide">Peak Day</div>
              <div className="text-[11px] text-gray-500">{peakDay.date}</div>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={Math.floor(chartData.length / 8)}
          />
          <YAxis
            tickFormatter={(v) => `$${v < 1 ? v.toFixed(2) : v.toFixed(0)}`}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <RechartsTooltip content={<DailyTokenCustomTooltip />} cursor={{ fill: 'rgba(115, 20, 148, 0.08)' }} />
          <Legend
            formatter={(value) => <span style={{ color: '#9ca3af', fontSize: 11 }}>{value}</span>}
            wrapperStyle={{ paddingTop: 8 }}
          />
          <Bar dataKey="estimatedCost" name="Daily Cost ($)" fill="#731494" radius={[3, 3, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend note */}
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-gray-400">
        <span className="flex items-center gap-1.5"><span style={{ width: 10, height: 10, borderRadius: 2, background: '#60a5fa', display: 'inline-block' }} /> Input tokens (est. 35% of cost @ $3/MTok)</span>
        <span className="flex items-center gap-1.5"><span style={{ width: 10, height: 10, borderRadius: 2, background: '#731494', display: 'inline-block' }} /> Output tokens (est. 55% of cost @ $15/MTok)</span>
        <span className="flex items-center gap-1.5"><span style={{ width: 10, height: 10, borderRadius: 2, background: '#6b7280', display: 'inline-block' }} /> Cache reads (est. 10% of cost @ $0.30/MTok)</span>
      </div>
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
  archived:    'border-gray-600/30 bg-gray-600/10 text-gray-300',
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
              <span className="text-[11px] text-gray-300 capitalize">{idea.category}</span>
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
          <p className="text-[11px] text-gray-300">Added by {idea.addedBy} · {new Date(idea.addedAt).toLocaleDateString()}</p>
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
          <span className="text-xs text-gray-300">Sort:</span>
          {[['votes','Votes'],['priority','Priority'],['newest','Newest']].map(([key,label]) => (
            <button key={key} onClick={() => setSortBy(key)}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${sortBy === key ? 'border-violet-500/40 text-violet-200' : 'border-[var(--brand-border)] text-gray-300 hover:text-gray-300'}`}>
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
              <label className="text-xs text-gray-300 mb-1 block">Category</label>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded-lg border border-[var(--brand-border)] bg-black/40 px-2 py-1.5 text-sm text-gray-300 focus:outline-none">
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_EMOJI[c]} {c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-300 mb-1 block">Priority</label>
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
        <div className="rounded-xl border border-[var(--brand-border)] bg-black/20 px-5 py-10 text-center text-sm text-gray-300">
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

// ─── Data Quality Tab (C3PO) ──────────────────────────────────────────────────
function DataQualityTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastChecked, setLastChecked] = useState(null)

  const runChecks = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/metrics/data-quality', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to run data quality checks')
      setData(json)
      setLastChecked(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { runChecks() }, [runChecks])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        style={{
          background: 'radial-gradient(circle at top left, #1a1202, transparent 60%), #0d0d1a',
          border: '1px solid #2a1a3e',
          borderRadius: 16,
          padding: '20px 24px',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div style={{ color: '#ca8a04', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
              🤖 C3PO · Data Quality Monitor
            </div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Data Integrity Checks</h2>
            <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>
              7 automated sanity checks against live data — finance freshness, MRR/ARR consistency, YTD cash, RPE bounds, and more.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastChecked && (
              <div style={{ color: '#6b7280', fontSize: 12 }}>
                Last checked: {lastChecked.toLocaleTimeString()}
              </div>
            )}
            <button
              onClick={runChecks}
              disabled={loading}
              style={{
                background: loading ? '#1a1a2e' : 'rgba(202, 138, 4, 0.15)',
                border: '1px solid rgba(202, 138, 4, 0.4)',
                borderRadius: 10,
                color: loading ? '#6b7280' : '#fbbf24',
                fontSize: 13,
                fontWeight: 600,
                padding: '8px 16px',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Running…' : '▶ Run Now'}
            </button>
          </div>
        </div>

        {/* Overall status banner */}
        {!loading && data && (
          <div
            style={{
              marginTop: 16,
              borderRadius: 10,
              padding: '10px 16px',
              background: data.allClear ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${data.allClear ? 'rgba(52, 211, 153, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 14,
              fontWeight: 700,
              color: data.allClear ? '#34d399' : '#f87171',
            }}
          >
            <span style={{ fontSize: 20 }}>{data.allClear ? '✅' : '🚨'}</span>
            {data.allClear
              ? `All ${data.checks.length} checks passed — data looks clean`
              : `${data.failures.length} of ${data.checks.length} checks failed — review below`
            }
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Check cards */}
      {loading && !data ? (
        <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 14, padding: '40px 0' }}>Running checks…</div>
      ) : data ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.checks.map((check, i) => (
            <div
              key={i}
              style={{
                background: '#0d0d1a',
                border: `1px solid ${check.pass ? 'rgba(52, 211, 153, 0.25)' : 'rgba(239, 68, 68, 0.35)'}`,
                borderRadius: 12,
                padding: '16px 18px',
                position: 'relative',
                boxShadow: check.pass ? 'none' : '0 0 20px rgba(239, 68, 68, 0.08)',
              }}
            >
              {/* Status strip at top */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 16,
                right: 16,
                height: 2,
                background: check.pass
                  ? 'linear-gradient(90deg, transparent, rgba(52, 211, 153, 0.6), transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.6), transparent)',
                borderRadius: 2,
              }} />

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ color: check.pass ? '#d1d5db' : '#fff', fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>
                  {check.name}
                </div>
                <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>
                  {check.pass ? '✅' : '❌'}
                </span>
              </div>

              <div style={{ marginTop: 8, color: check.pass ? '#34d399' : '#fbbf24', fontSize: 13, fontWeight: 600 }}>
                {check.value}
              </div>

              {check.note && (
                <div style={{
                  marginTop: 8,
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 7,
                  padding: '6px 10px',
                  color: '#fca5a5',
                  fontSize: 11.5,
                  lineHeight: 1.5,
                }}>
                  ⚠ {check.note}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* Failures summary */}
      {data && data.failures.length > 0 && (
        <div
          style={{
            background: '#0d0d1a',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 12,
            padding: '16px 20px',
          }}
        >
          <div style={{ color: '#f87171', fontWeight: 700, fontSize: 13, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            🚨 Failures Summary
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.failures.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#d1d5db' }}>
                <span style={{ color: '#f87171', flexShrink: 0 }}>❌</span>
                <span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{f.name}:</span>{' '}
                  <span style={{ color: '#fbbf24' }}>{f.value}</span>
                  {f.note && <span style={{ color: '#9ca3af' }}> — {f.note}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Scheduler Tab ──────────────────────────────────────────────────────────
function SchedulerTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [nodeFilter, setNodeFilter] = useState('all')
  const [lastRefresh, setLastRefresh] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/mission-control/crons')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setLastRefresh(new Date())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  const jobs = data?.all || []
  const filtered = nodeFilter === 'all' ? jobs : jobs.filter(j => j.node === nodeFilter)
  const summary = data?.summary || { total: 0, ok: 0, error: 0, idle: 0 }

  const statusColor = (s) => {
    if (s === 'ok') return 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
    if (s === 'error') return 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    if (s === 'idle') return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    return 'bg-amber-500/20 text-amber-200 border-amber-500/30'
  }

  return (
    <Panel
      title="Scheduler"
      action={
        <span className="text-xs text-gray-500">
          {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : 'Loading...'}
        </span>
      }
    >
      {loading && !data && (
        <div className="py-8 text-center text-sm text-gray-400">Loading cron jobs…</div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          ⚠ Failed to load: {error}
        </div>
      )}
      {data && (
        <>
          {/* Summary bar */}
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--brand-border)] bg-black/30 px-4 py-2">
              <span className="text-xs text-gray-400">Total</span>
              <span className="text-lg font-bold text-white">{summary.total}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
              <span className="text-xs text-emerald-400">OK</span>
              <span className="text-lg font-bold text-emerald-200">{summary.ok}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2">
              <span className="text-xs text-rose-400">Error</span>
              <span className="text-lg font-bold text-rose-200">{summary.error}</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-gray-500/30 bg-gray-500/10 px-4 py-2">
              <span className="text-xs text-gray-400">Idle</span>
              <span className="text-lg font-bold text-gray-200">{summary.idle}</span>
            </div>
          </div>

          {/* Node filter */}
          <div className="mb-4 flex gap-2">
            {['all', 'Mac Mini', 'Mac Studio'].map(n => (
              <button
                key={n}
                onClick={() => setNodeFilter(n)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  nodeFilter === n
                    ? 'border-violet-500/50 bg-violet-500/20 text-violet-200'
                    : 'border-[var(--brand-border)] bg-black/20 text-gray-400 hover:text-white'
                }`}
              >
                {n === 'all' ? `All (${jobs.length})` : `${n} (${n === 'Mac Mini' ? (data?.mini?.length || 0) : (data?.eve?.length || 0)})`}
              </button>
            ))}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">No cron jobs found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--brand-border)] text-xs text-gray-500">
                    <th className="pb-2 pr-4 text-left font-medium">Name</th>
                    <th className="pb-2 pr-4 text-left font-medium">Node</th>
                    <th className="pb-2 pr-4 text-left font-medium">Schedule</th>
                    <th className="pb-2 pr-4 text-left font-medium">Next</th>
                    <th className="pb-2 pr-4 text-left font-medium">Last</th>
                    <th className="pb-2 pr-4 text-left font-medium">Status</th>
                    <th className="pb-2 text-left font-medium">Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--brand-border)]">
                  {filtered.map(j => (
                    <tr key={`${j.node}-${j.id}`} className="group hover:bg-white/5">
                      <td className="py-2.5 pr-4 font-medium text-white">{j.name}</td>
                      <td className="py-2.5 pr-4">
                        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300">
                          {j.node}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-gray-300">{j.schedule}</td>
                      <td className="py-2.5 pr-4 text-gray-300">{j.next}</td>
                      <td className="py-2.5 pr-4 text-gray-400">{j.last}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${statusColor(j.status)}`}>
                          {j.status}
                        </span>
                      </td>
                      <td className="py-2.5 max-w-[140px] truncate text-xs text-gray-400" title={j.agentId}>{j.agentId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Panel>
  )
}
