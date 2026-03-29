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
    <aside style={{ backgroundColor: '#0a0a0a', borderRight: '1px solid #2a1a3e' }} className="w-64 shrink-0 p-4">
      <div className="mb-4 rounded-xl border border-[var(--brand-border)] bg-black/30 px-3 py-3">
        <div className="text-xs uppercase tracking-[0.2em] text-violet-300">Mission Control</div>
        <div className="mt-1 text-sm font-semibold text-white">Custom Nav</div>
      </div>

      <nav className="space-y-2">
        {links.map(([label, href]) => (
          <a key={href} href={href} className="block rounded-lg border border-[var(--brand-border)] bg-black/20 px-3 py-2 text-sm text-gray-200 transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white">
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

  if (missionControlMode) {
    return (
      <div className="flex h-screen">
        <MissionControlNav />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
