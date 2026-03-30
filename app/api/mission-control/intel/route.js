import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'os'

export const dynamic = 'force-dynamic'

const FULCRUM_MEMOS_DIR = process.env.FULCRUM_MEMOS_PATH
  || path.join(os.homedir(), '../toddlavictoire/.openclaw/workspace-fulcrum/memory/memos')

const DIGEST_PATH = process.env.FULCRUM_DIGEST_PATH
  || path.join(os.homedir(), '.openclaw/workspace/memory/fulcrum-digest.md')

function parseConfidence(text) {
  const m = text.match(/\*\*Confidence\*\*[:\s]+(HIGH|MEDIUM|LOW)/i)
  return m?.[1]?.toUpperCase() || null
}

function parseRecommendedAction(text) {
  const m = text.match(/\*\*Recommended [Aa]ction\*\*[:\s]*\n([^\n]+)/i)
    || text.match(/## Recommended [Aa]ction\n([^\n]+)/i)
  return m?.[1]?.trim() || null
}

function parseFindings(text) {
  // Look for the findings section — bullet points after "key findings"
  const section = text.match(/##.*?[Ff]indings?\n([\s\S]+?)(?=\n##|\n---|\*\*Recommended)/)?.[1] || ''
  return section
    .split('\n')
    .filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'))
    .map(l => l.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5)
}

function slugToLabel(slug) {
  return slug
    .replace(/^\d{4}-\d{2}-\d{2}-/, '')
    .replace(/\.md$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

async function getMemos() {
  try {
    const files = await fs.readdir(FULCRUM_MEMOS_DIR)
    const mdFiles = files.filter(f => f.endsWith('.md')).sort().reverse() // newest first

    const memos = []
    for (const file of mdFiles.slice(0, 20)) {
      const raw = await fs.readFile(path.join(FULCRUM_MEMOS_DIR, file), 'utf8')
      const titleMatch = raw.match(/^#\s+(.+)/m)
      const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/)
      const urgent = file.includes('[URGENT]') || raw.includes('[URGENT]')

      memos.push({
        id: file.replace('.md', ''),
        file,
        date: dateMatch?.[1] || null,
        title: titleMatch?.[1]?.trim() || slugToLabel(file),
        confidence: parseConfidence(raw),
        recommendedAction: parseRecommendedAction(raw),
        findings: parseFindings(raw),
        urgent,
        preview: raw.slice(0, 400).replace(/^#[^\n]+\n/, '').trim(),
        fullText: raw,
      })
    }
    return memos
  } catch {
    return []
  }
}

async function getDigest() {
  try {
    const raw = await fs.readFile(DIGEST_PATH, 'utf8')
    return raw
      .split('\n')
      .filter(l => l.trim().startsWith('['))
      .map(l => {
        const m = l.match(/^\[(\d{4}-\d{2}-\d{2})\]\s+(.+)/)
        return m ? { date: m[1], text: m[2] } : null
      })
      .filter(Boolean)
      .reverse()
      .slice(0, 30)
  } catch {
    return []
  }
}

export async function GET() {
  const [memos, digest] = await Promise.all([getMemos(), getDigest()])

  return NextResponse.json({
    memos,
    digest,
    memosDir: FULCRUM_MEMOS_DIR,
    updatedAt: new Date().toISOString(),
  })
}
