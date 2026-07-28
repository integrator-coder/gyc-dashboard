#!/usr/bin/env node

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const configPath = process.env.OPENCLAW_CONFIG || path.join(os.homedir(), '.openclaw', 'openclaw.json')
const outputPath = path.resolve(import.meta.dirname, '..', 'data', 'agent-models.generated.json')

function displayName(model) {
  if (!model) return '—'
  const id = String(model).split('/').pop()
  const known = {
    'gpt-5.6-sol': 'GPT-5.6 Sol',
    'gpt-5.4': 'GPT-5.4',
    'gpt-5.3-codex': 'GPT-5.3 Codex',
    'deepseek-v4-flash': 'DeepSeek V4 Flash',
    'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-3.6-flash': 'Gemini 3.6 Flash',
  }
  if (known[id]) return known[id]
  return id
    .split('-')
    .map((part) => /^(gpt|ai|v\d+)$/i.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function shortAgentName(name) {
  return String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim()
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const agents = config?.agents?.list || []
const defaults = config?.agents?.defaults || {}

const agentModels = {}
const agentHeartbeats = {}
for (const agent of agents) {
  const name = shortAgentName(agent.name || agent.id)
  agentModels[name] = displayName(agent.model || defaults?.model?.primary)
  if (agent?.heartbeat?.model) agentHeartbeats[name] = displayName(agent.heartbeat.model)
}

const sorted = (value) => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
const payload = {
  agentModels: sorted(agentModels),
  agentHeartbeats: sorted(agentHeartbeats),
  defaults: {
    primary: displayName(defaults?.model?.primary),
    heartbeat: displayName(defaults?.heartbeat?.model),
    subagents: displayName(defaults?.subagents?.model),
  },
}

const next = `${JSON.stringify(payload, null, 2)}\n`
const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : ''
if (current === next) {
  console.log('Agent model roster already current.')
  process.exit(0)
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, next)
console.log(`Updated ${outputPath}`)
