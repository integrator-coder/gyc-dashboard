'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

const DASHBOARD_GROUP = {
  label: 'Dashboard',
  emoji: '📊',
  children: [
    {
      label: 'Leadership',
      emoji: '🏆',
      items: [
        { label: 'Overview', emoji: '🏆', href: '/leadership' },
        { label: 'HR', emoji: '🧑', href: '/hr' },
      ],
    },
    {
      label: 'Finance',
      emoji: '💰',
      items: [
        { label: 'Overview', emoji: '💰', href: '/finance' },
        { label: 'Churn', emoji: '📉', href: '/churn' },
        { label: 'Dunning', emoji: '⚠️', href: '/dunning' },
      ],
    },
    {
      label: 'Sales',
      emoji: '📞',
      items: [
        { label: 'Sales Activity', emoji: '📞', href: '/sales-activity' },
        { label: 'New Business', emoji: '💵', href: '/new-business' },
      ],
    },
    {
      label: 'CX',
      emoji: '👥',
      items: [
        { label: 'CX Overview', emoji: '👥', href: '/cx' },
        { label: 'Client Results', emoji: '📊', href: '/clients' },
        { label: 'Web Analytics', emoji: '📈', href: '/web-analytics' },
        { label: 'Helpdesk', emoji: '🌐', href: '/helpdesk' },
      ],
    },
    {
      label: 'Marketing',
      emoji: '📣',
      href: '/marketing',
    },
    {
      label: 'Production',
      emoji: '🔧',
      href: '/production',
    },
  ],
}

const TEAM_PORTAL_ITEMS = [
  { label: 'CX Handoffs', emoji: '🧾', href: '/cx-handoff' },
  { label: 'Classify Calls', emoji: '🏷️', href: '/team/classify', roles: ['sales', 'ga', 'admin'] },
  { label: 'CX Review & Q&A', emoji: '🧠', href: '/team/cx', roles: ['cx', 'admin'] },
  { label: 'Recon & Intel', emoji: '🔍', href: '/team/recon', roles: ['recon', 'admin'] },
]

function hasRole(user, allowedRoles = []) {
  if (!allowedRoles.length) return true
  const roles = new Set([...(user?.roles || []), ...(user?.teams || []), user?.role].filter(Boolean).map((value) => String(value).toLowerCase()))
  return allowedRoles.some((role) => roles.has(String(role).toLowerCase()))
}

function DashboardGroup({ group, pathname }) {
  const isChildActive = group.children.some((child) => child.href ? pathname === child.href : child.items?.some((item) => pathname === item.href))
  const [manualOpen, setManualOpen] = useState(isChildActive)
  const open = isChildActive || manualOpen

  useEffect(() => {
    if (isChildActive) setManualOpen(true)
  }, [isChildActive])

  return (
    <div>
      <button
        onClick={() => setManualOpen((current) => !current)}
        style={isChildActive ? { color: '#f5f5f5', backgroundColor: '#1a0a2e' } : { color: '#d1d5db' }}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${isChildActive ? '' : 'hover:bg-[#1a0a2e] hover:text-white'}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-base">{group.emoji}</span>
          <span>{group.label}</span>
        </div>
        <span style={{ color: '#6d4c89', fontSize: '12px' }} className={`transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>

      {open && (
        <div className="ml-3 mt-2 space-y-3 border-l border-[#2a1a3e] pl-4">
          {group.children.map((child) => {
            if (child.href) {
              const isActive = pathname === child.href
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  style={isActive ? {
                    backgroundColor: '#731494',
                    color: '#ffffff',
                    borderLeft: '3px solid #AE2BCF',
                    paddingLeft: '10px',
                  } : { color: '#9ca3af' }}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? '' : 'hover:bg-[#1a0a2e] hover:text-white'}`}
                >
                  <span className="text-sm">{child.emoji}</span>
                  <span>{child.label}</span>
                </Link>
              )
            }

            return (
              <div key={child.label} className="space-y-1.5">
                <div className="flex items-center gap-2 px-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300/80">
                  <span className="text-sm normal-case tracking-normal">{child.emoji}</span>
                  <span>{child.label}</span>
                </div>
                <div className="space-y-0.5">
                  {child.items.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={isActive ? {
                          backgroundColor: '#731494',
                          color: '#ffffff',
                          borderLeft: '3px solid #AE2BCF',
                          paddingLeft: '10px',
                        } : { color: '#9ca3af' }}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? '' : 'hover:bg-[#1a0a2e] hover:text-white'} font-medium`}
                      >
                        <span className="text-sm">{item.emoji}</span>
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [session, setSession] = useState({ loading: true, user: null })

  useEffect(() => {
    let active = true
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => { if (active) setSession({ loading: false, user: json.user || null }) })
      .catch(() => { if (active) setSession({ loading: false, user: null }) })
    return () => { active = false }
  }, [pathname])

  const teamPortalItems = useMemo(
    () => TEAM_PORTAL_ITEMS.filter((item) => hasRole(session.user, item.roles)),
    [session.user],
  )

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <aside style={{ backgroundColor: '#0a0a0a', borderRight: '1px solid #2a1a3e' }} className="w-60 flex flex-col shrink-0">
      <div className="px-5 py-6" style={{ borderBottom: '1px solid #2a1a3e' }}>
        <div className="flex items-center gap-2">
          <div style={{ background: 'linear-gradient(135deg, #731494, #AE2BCF)' }} className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white">G</div>
          <div>
            <div style={{ color: '#AE2BCF' }} className="font-bold text-sm leading-none">GYC</div>
            <div style={{ color: '#4a3060' }} className="text-xs mt-0.5">KPI Dashboard</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-4">
        <DashboardGroup group={DASHBOARD_GROUP} pathname={pathname} />

        <div className="space-y-1">
          <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-300/70">
            Team Portal
          </div>
          {teamPortalItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                style={isActive ? {
                  backgroundColor: '#731494',
                  color: '#ffffff',
                  borderLeft: '3px solid #AE2BCF',
                  paddingLeft: '10px',
                } : { color: '#9ca3af' }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? '' : 'hover:bg-[#1a0a2e] hover:text-white'}`}
              >
                <span className="text-base">{item.emoji}</span>
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="px-5 py-4 space-y-3" style={{ borderTop: '1px solid #2a1a3e' }}>
        {session.loading ? (
          <p style={{ color: '#4a3060' }} className="text-xs">Checking session…</p>
        ) : session.user ? (
          <>
            <div>
              <div className="text-sm font-medium text-white">{session.user.name}</div>
              <div className="text-xs text-gray-500">{session.user.email}</div>
            </div>
            <button onClick={logout} className="w-full rounded-lg border border-[var(--brand-border)] px-3 py-2 text-xs font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white">Log out</button>
          </>
        ) : (
          <Link href="/login" className="block rounded-lg border border-[var(--brand-border)] px-3 py-2 text-center text-xs font-medium text-gray-300 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white">Log in</Link>
        )}
        <p style={{ color: '#4a3060' }} className="text-xs">Grow Your Childcare</p>
      </div>
    </aside>
  )
}
