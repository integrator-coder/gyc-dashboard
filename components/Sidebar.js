'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

// ─── Role helpers ─────────────────────────────────────────────────────────────
function canSeeFinance(user) {
  return ['superadmin', 'admin'].includes(user?.role)
}

function isAdminPlus(user) {
  return ['superadmin', 'admin'].includes(user?.role)
}

function buildDashboardGroup(user) {
  const children = []

  // Leadership — admin+ only
  if (isAdminPlus(user)) {
    children.push({
      label: 'Leadership',
      emoji: '🏆',
      items: [
        { label: 'Overview', emoji: '🏆', href: '/leadership' },
        { label: 'HR', emoji: '🧑‍💼', href: '/hr' },
      ],
    })
  }

  // Finance — admin+ only
  if (canSeeFinance(user)) {
    children.push({
      label: 'Finance',
      emoji: '💰',
      items: [
        { label: 'Overview', emoji: '💰', href: '/finance' },
        { label: 'Churn', emoji: '📉', href: '/churn' },
        { label: 'Dunning', emoji: '⚠️', href: '/dunning' },
        { label: 'Agreements', emoji: '📝', href: '/agreements' },
        { label: 'Stripe Deep Dive', emoji: '💳', href: '/stripe-deep-dive' },
      ],
    })
  }

  // Sales — visible to all
  children.push({
    label: 'Sales',
    emoji: '📞',
    items: [
      { label: 'Sales Activity', emoji: '📞', href: '/sales-activity' },
      { label: 'New Business', emoji: '💵', href: '/new-business' },
      ...(['superadmin', 'admin', 'ga', 'sales'].includes(user?.role)
        ? [{ label: 'Sales Analysis', emoji: '🧮', href: '/sales-analysis' }]
        : []),
    ],
  })

  // CX — visible to all
  children.push({
    label: 'CX',
    emoji: '👥',
    items: [
      { label: 'CX Overview', emoji: '👥', href: '/cx' },
      { label: 'Client Results', emoji: '📊', href: '/client-results' },
      { label: 'Web Analytics', emoji: '📈', href: '/web-analytics' },
      { label: 'Helpdesk', emoji: '🌐', href: '/helpdesk' },
    ],
  })

  // Marketing — visible to all
  children.push({ label: 'Marketing', emoji: '📣', href: '/marketing' })

  // Production — ga and admin+ only
  if (['superadmin', 'admin', 'ga'].includes(user?.role)) {
    children.push({ label: 'Production', emoji: '🔧', href: '/production' })
  }

  return {
    label: 'Dashboard',
    emoji: '📊',
    defaultOpen: true,
    children,
  }
}

const TEAM_PORTAL_GROUP = {
  label: 'Team Portal',
  emoji: '🧩',
  defaultOpen: true,
  children: [
    { label: 'CX Handoffs', emoji: '🧾', href: '/cx-handoff', roles: ['sales', 'ga', 'cx', 'admin', 'superadmin'] },
    { label: 'Client Intel', emoji: '🧠', href: '/clients', roles: ['ga', 'cx', 'admin', 'superadmin'] },
    { label: 'Recon', emoji: '🔍', href: '/team/recon', roles: ['recon', 'admin', 'superadmin'] },
  ],
}

const ADMIN_GROUP = {
  label: 'Admin',
  emoji: '⚙️',
  defaultOpen: false,
  children: [
    { label: '👥 Users', emoji: '👥', href: '/admin/users' },
  ],
}

function hasRole(user, allowedRoles = []) {
  if (!allowedRoles.length) return true
  const roles = new Set([...(user?.roles || []), ...(user?.teams || []), user?.role].filter(Boolean).map((value) => String(value).toLowerCase()))
  return allowedRoles.some((role) => roles.has(String(role).toLowerCase()))
}

function itemIsActive(pathname, href) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function groupHasActiveChild(group, pathname) {
  return group.children.some((child) => child.href
    ? itemIsActive(pathname, child.href)
    : child.items?.some((item) => itemIsActive(pathname, item.href))
  )
}

function GroupLink({ item, pathname }) {
  const isActive = itemIsActive(pathname, item.href)
  return (
    <Link
      href={item.href}
      style={isActive ? {
        backgroundColor: '#731494',
        color: '#ffffff',
        borderLeft: '3px solid #AE2BCF',
        paddingLeft: '10px',
      } : { color: '#9ca3af' }}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? '' : 'hover:bg-[#1a0a2e] hover:text-white'}`}
    >
      <span className="text-sm">{item.emoji}</span>
      <span>{item.label}</span>
    </Link>
  )
}

function CollapsibleGroup({ group, pathname }) {
  const isChildActive = groupHasActiveChild(group, pathname)
  const [manualOpen, setManualOpen] = useState(group.defaultOpen ?? true)
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
              return <GroupLink key={child.href} item={child} pathname={pathname} />
            }

            return (
              <div key={child.label} className="space-y-1.5">
                <div className="flex items-center gap-2 px-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300/80">
                  <span className="text-sm normal-case tracking-normal">{child.emoji}</span>
                  <span>{child.label}</span>
                </div>
                <div className="space-y-0.5">
                  {child.items.map((item) => (
                    <GroupLink key={item.href} item={item} pathname={pathname} />
                  ))}
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

  const dashboardGroup = useMemo(() => buildDashboardGroup(session.user), [session.user])

  const teamPortalGroup = useMemo(() => ({
    ...TEAM_PORTAL_GROUP,
    children: TEAM_PORTAL_GROUP.children.filter((item) => hasRole(session.user, item.roles)),
  }), [session.user])

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

      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        <CollapsibleGroup group={dashboardGroup} pathname={pathname} />
        <CollapsibleGroup group={teamPortalGroup} pathname={pathname} />
        {isAdminPlus(session.user) && (
          <CollapsibleGroup group={ADMIN_GROUP} pathname={pathname} />
        )}
      </nav>

      <div className="px-5 py-4 space-y-3" style={{ borderTop: '1px solid #2a1a3e' }}>
        {session.loading ? (
          <p style={{ color: '#4a3060' }} className="text-xs">Checking session…</p>
        ) : session.user ? (
          <>
            <div>
              <div className="text-sm font-medium text-white">{session.user.name}</div>
              <div className="text-xs text-gray-300">{session.user.email}</div>
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
