'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: 'Leadership', emoji: '🏆', href: '/leadership' },
  { label: 'Finance', emoji: '💰', href: '/finance' },
  { label: 'Sales Activity', emoji: '📞', href: '/sales-activity' },
  { label: 'New Business', emoji: '💵', href: '/new-business' },
  { label: 'CX', emoji: '👥', href: '/cx' },
  { label: 'Marketing', emoji: '📣', href: '/marketing' },
  { label: 'Production', emoji: '🔧', href: '/production' },
  { label: 'HR', emoji: '🧑', href: '/hr' },
  { label: 'Churn', emoji: '📉', href: '/churn' },
  { label: 'Dunning', emoji: '⚠️', href: '/dunning' },
  { label: 'Helpdesk', emoji: '🌐', href: '/helpdesk' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
      {/* Branding */}
      <div className="px-5 py-6 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">
            G
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">GYC</div>
            <div className="text-gray-500 text-xs mt-0.5">KPI Dashboard</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href === '/finance' && pathname === '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className="text-base">{item.emoji}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800">
        <p className="text-gray-600 text-xs">Grow Your Childcare</p>
      </div>
    </aside>
  )
}
