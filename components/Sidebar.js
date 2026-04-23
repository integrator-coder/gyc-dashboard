'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

function canSeeFinance(user) {
  return ['superadmin', 'admin'].includes(user?.role)
}

function isAdminPlus(user) {
  return ['superadmin', 'admin'].includes(user?.role)
}

function buildDashboardGroup(user) {
  const children = []

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
        { label: 'Projections', emoji: '📈', href: '/projections' },
      ],
    })
  }

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

  children.push({ label: 'Marketing', emoji: '📣', href: '/marketing' })

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

const CLIENT_MANAGEMENT_GROUP = {
  label: 'Client Management',
  emoji: '👥',
  defaultOpen: true,
  children: [
    { label: 'Active Clients', emoji: '👥', href: '/clients', roles: ['ga', 'cx', 'admin', 'superadmin'] },
  ],
}

const TEAM_PORTAL_GROUP = {
  label: 'Team Portal',
  emoji: '🧩',
  defaultOpen: true,
  children: [
    { label: 'CX Handoffs', emoji: '🧾', href: '/cx-handoff', roles: ['sales', 'ga', 'cx', 'admin', 'superadmin'] },
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
      className={`nav-link flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium ${isActive ? 'nav-link-active' : ''}`}
    >
      <span className="text-sm">{item.emoji}</span>
      <span>{item.label}</span>
    </Link>
  )
}

function CollapsibleGroup({ group, pathname }) {
  const isChildActive = groupHasActiveChild(group, pathname)
  const [manualOpen, setManualOpen] = useState(group.defaultOpen ?? true)
  const open = isChildActive ? true : manualOpen

  return (
    <div>
      <button
        onClick={() => setManualOpen((current) => !current)}
        data-active={isChildActive}
        className="nav-section-trigger flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold"
      >
        <div className="flex items-center gap-3">
          <span className="text-base">{group.emoji}</span>
          <span>{group.label}</span>
        </div>
        <span className={`text-xs executive-faint transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>

      {open && (
        <div className="ml-3 mt-2 space-y-3 border-l border-[var(--brand-border)] pl-4">
          {group.children.map((child) => {
            if (child.href) {
              return <GroupLink key={child.href} item={child} pathname={pathname} />
            }

            return (
              <div key={child.label} className="space-y-1.5">
                <div className="flex items-center gap-2 px-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-text-muted)]">
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

  const clientManagementGroup = useMemo(() => ({
    ...CLIENT_MANAGEMENT_GROUP,
    children: CLIENT_MANAGEMENT_GROUP.children.filter((item) => hasRole(session.user, item.roles)),
  }), [session.user])

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
    <aside className="nav-shell flex w-64 shrink-0 flex-col">
      <div className="border-b border-[var(--brand-border)] px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--brand-border-accent)] bg-[linear-gradient(180deg,rgba(166,111,205,0.38),rgba(95,53,132,0.92))] text-sm font-bold text-white shadow-[0_12px_28px_rgba(95,53,132,0.26)]">G</div>
          <div>
            <div className="text-sm font-bold leading-none text-white">GYC</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.22em] executive-faint">KPI Dashboard</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        <CollapsibleGroup group={dashboardGroup} pathname={pathname} />
        {clientManagementGroup.children.length > 0 && (
          <CollapsibleGroup group={clientManagementGroup} pathname={pathname} />
        )}
        <CollapsibleGroup group={teamPortalGroup} pathname={pathname} />
        {isAdminPlus(session.user) && (
          <CollapsibleGroup group={ADMIN_GROUP} pathname={pathname} />
        )}
      </nav>

      <div className="space-y-3 border-t border-[var(--brand-border)] px-5 py-4">
        {session.loading ? (
          <p className="text-xs executive-faint">Checking session…</p>
        ) : session.user ? (
          <>
            <div>
              <div className="text-sm font-medium text-white">{session.user.name}</div>
              <div className="text-xs executive-muted">{session.user.email}</div>
            </div>
            <button onClick={logout} className="executive-button-secondary w-full px-3 py-2 text-xs">Log out</button>
          </>
        ) : (
          <Link href="/login" className="executive-button-secondary block w-full px-3 py-2 text-center text-xs">Log in</Link>
        )}
        <p className="text-xs executive-faint">Grow Your Childcare</p>
      </div>
    </aside>
  )
}
