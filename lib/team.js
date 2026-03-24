const REP_ALIASES = {
  'todd@growyourcenter.com': ['Todd', 'Todd Lavictoire', 'Todd Lavictoire:'],
  'jesse@growyourcenter.com': ['Jesse', 'Jesse Poirier'],
  'briana@growyourcenter.com': ['Briana', 'Briana Stewart'],
  'jc@growyourcenter.com': ['JC'],
  'stefen@growyourcenter.com': ['Stefen', 'Stefen Anderson'],
  'sebastian@growyourcenter.com': ['Sebastian'],
  'zu@growyourcenter.com': ['Zu'],
  'pia@growyourcenter.com': ['Pia'],
}

export function getRepAliases(user) {
  const email = String(user?.email || '').toLowerCase()
  const aliases = new Set(REP_ALIASES[email] || [])
  if (user?.name) aliases.add(user.name)

  return Array.from(aliases)
    .map((value) => String(value || '').trim())
    .filter(Boolean)
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }
  return `${minutes}m ${remainingSeconds}s`
}

export function formatTimestamp(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function tokenizeSearchQuery(query) {
  return Array.from(
    new Set(
      String(query || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
    )
  )
}
