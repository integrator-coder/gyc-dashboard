'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

function HamburgerIcon({ isOpen }) {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      {isOpen ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6h16M4 12h16M4 18h16"
        />
      )}
    </svg>
  )
}

// Role sets — mirror actual route requireUser() calls exactly
const ADMIN_ONLY    = ['superadmin', 'admin']
const ADMIN_MANAGER = ['superadmin', 'admin', 'manager']
const SALES_ROLES   = ['sales', 'ga', 'staff', 'admin', 'superadmin']
const WIDE_ROLES    = ['sales', 'ga', 'staff', 'cx', 'admin', 'superadmin', 'manager']
const GA_ROLES      = ['ga', 'cx', 'staff', 'admin', 'superadmin', 'manager']

function canSee(user, roles) {
  if (!roles || roles.length === 0) return true
  return roles.includes(user?.role)
}

function buildDashboardGroup(user) {
  const children = []

  // Leadership — filter items individually by actual route permissions
  const leadershipItems = [
    canSee(user, ADMIN_ONLY)    && { label: 'Overview', emoji: '🏆', href: '/leadership' },
    canSee(user, ADMIN_ONLY)    && { label: 'HR',       emoji: '🧑‍💼', href: '/hr' },
    canSee(user, ADMIN_MANAGER) && { label: 'Harvest',  emoji: '🕐', href: '/harvest' },
  ].filter(Boolean)
  if (leadershipItems.length) {
    children.push({ label: 'Leadership', emoji: '🏆', items: leadershipItems })
  }

  // Finance — admin/superadmin only
  if (canSee(user, ADMIN_ONLY)) {
    children.push({
      label: 'Finance',
      emoji: '💰',
      items: [
        { label: 'Overview',         emoji: '💰', href: '/finance' },
        { label: 'Churn',            emoji: '📉', href: '/churn' },
        { label: 'Dunning',          emoji: '⚠️', href: '/dunning' },
        { label: 'Agreements',       emoji: '📝', href: '/agreements' },
        { label: 'Stripe Deep Dive', emoji: '💳', href: '/stripe-deep-dive' },
        { label: 'Projections',      emoji: '📈', href: '/projections' },
        { label: 'Linkage Review',   emoji: '🧩', href: '/finance/linkage-review' },
      ],
    })
  }

  // Sales — filter items individually
  const salesItems = [
    canSee(user, WIDE_ROLES)  && { label: 'Sales Activity', emoji: '📞', href: '/sales-activity' },
    canSee(user, SALES_ROLES) && { label: 'New Business',   emoji: '💵', href: '/new-business' },
    canSee(user, SALES_ROLES) && { label: 'Sales Analysis', emoji: '🧮', href: '/sales-analysis' },
  ].filter(Boolean)
  if (salesItems.length) {
    children.push({ label: 'Sales', emoji: '📞', items: salesItems })
  }

  // CX
  children.push({
    label: 'CX',
    emoji: '👥',
    items: [
      canSee(user, WIDE_ROLES) && { label: 'CX Overview',    emoji: '👥', href: '/cx' },
      { label: 'Client Results', emoji: '📊', href: '/client-results' },
      canSee(user, WIDE_ROLES) && { label: 'Web Analytics',  emoji: '📈', href: '/web-analytics' },
      { label: 'Helpdesk',       emoji: '🌐', href: '/helpdesk' },
    ].filter(Boolean),
  })

  children.push({ label: 'Marketing', emoji: '📣', href: '/marketing' })

  if (canSee(user, GA_ROLES)) {
    children.push({ label: 'Production', emoji: '🔧', href: '/production' })
    children.push({ label: 'Workload',   emoji: '⚙️', href: '/workload' })
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
    { label: 'Active Clients', emoji: '👥', href: '/clients', roles: ['ga', 'cx', 'admin', 'superadmin', 'manager'] },
  ],
}

const TEAM_PORTAL_GROUP = {
  label: 'Team Portal',
  emoji: '🧩',
  defaultOpen: true,
  children: [
    { label: 'CX Handoffs', emoji: '🧾', href: '/cx-handoff', roles: ['sales', 'ga', 'cx', 'admin', 'superadmin', 'manager'] },
    { label: 'Recon', emoji: '🔍', href: '/team/recon', roles: ['recon', 'admin', 'superadmin', 'manager'] },
    { label: 'Toolkit', emoji: '🔧', href: '/team/toolkit', roles: ['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin', 'manager'] },
    { label: 'Presentation Library', emoji: '🎬', href: '/team/presentations', roles: ['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin', 'manager'] },
    { label: 'AI Training Hub', emoji: '🤖', href: 'https://www.notion.so/growyourcenter/362ca865e19781c2b416d4e96b008c22', roles: ['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin', 'manager'], external: true },
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

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="nav-link flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium"
      >
        <span className="text-sm">{item.emoji}</span>
        <span>{item.label}</span>
        <span className="ml-auto text-[10px] text-gray-600">↗</span>
      </a>
    )
  }

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Close mobile menu when pathname changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

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
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] text-white shadow-lg md:hidden"
        aria-label="Toggle menu"
      >
        <HamburgerIcon isOpen={isMobileMenuOpen} />
      </button>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          nav-shell flex w-64 shrink-0 flex-col
          fixed md:relative inset-y-0 left-0 z-40
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
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
        {canSee(session.user, ADMIN_ONLY) && (
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
    </>
  )
}
