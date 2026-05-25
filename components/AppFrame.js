'use client'

import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

function MissionControlNav() {
  const links = [
    ['Overview', '#overview'],
    ['Task Board', '#task-board'],
    ['Schedule', '#schedule'],
    ['Eve Sync', '#eve-sync'],
    ['Escalation Radar', '#escalation-radar'],
    ['Cost', '#cost-control'],
  ]

  return (
    <aside className="nav-shell w-64 shrink-0 p-4">
      <div className="surface-card mb-4 rounded-2xl px-4 py-4">
        <div className="executive-kicker text-violet-200">Mission Control</div>
        <div className="mt-1 text-sm font-semibold text-white">Custom Nav</div>
      </div>

      <nav className="space-y-2">
        {links.map(([label, href]) => (
          <a key={href} href={href} className="nav-link block rounded-xl px-3 py-2 text-sm font-medium">
            {label}
          </a>
        ))}
      </nav>
    </aside>
  )
}

export default function AppFrame({ children }) {
  const pathname = usePathname()
  const missionControlMode = pathname?.startsWith('/team/mission-control')

  if (pathname === '/login') {
    return <>{children}</>
  }

  if (missionControlMode) {
    return (
      <div className="flex min-h-screen executive-app-shell">
        <MissionControlNav />
        <main className="page-shell flex-1 overflow-auto px-6 py-6 md:px-8 md:py-7">{children}</main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen executive-app-shell">
      <Sidebar />
      <main className="page-shell flex-1 overflow-auto px-6 py-6 pt-16 md:px-8 md:py-7">{children}</main>
    </div>
  )
}
