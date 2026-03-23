'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const NAV = [
  {
    label: 'Leadership', emoji: '🏆', group: true,
    children: [
      { label: 'Overview', emoji: '🏆', href: '/leadership' },
      { label: 'HR',       emoji: '🧑', href: '/hr' },
    ],
  },
  {
    label: 'Finance', emoji: '💰', group: true,
    children: [
      { label: 'Overview', emoji: '💰', href: '/finance' },
      { label: 'Churn',    emoji: '📉', href: '/churn' },
      { label: 'Dunning',  emoji: '⚠️', href: '/dunning' },
    ],
  },
  {
    label: 'Sales', emoji: '📞', group: true,
    children: [
      { label: 'Sales Activity', emoji: '📞', href: '/sales-activity' },
      { label: 'New Business',   emoji: '💵', href: '/new-business' },
    ],
  },
  {
    label: 'CX', emoji: '👥', group: true,
    children: [
      { label: 'CX Overview',    emoji: '👥', href: '/cx' },
      { label: 'Client Results', emoji: '📊', href: '/clients' },
      { label: 'Web Analytics',  emoji: '📈', href: '/web-analytics' },
      { label: 'Helpdesk',       emoji: '🌐', href: '/helpdesk' },
    ],
  },
  {
    label: 'Operations', emoji: '🛠️', group: true,
    children: [
      { label: 'CX Handoffs', emoji: '🧾', href: '/cx-handoff' },
    ],
  },
  { label: 'Marketing',  emoji: '📣', href: '/marketing' },
  { label: 'Production', emoji: '🔧', href: '/production' },
]

function GroupItem({ group, pathname }) {
  const isChildActive = group.children.some(c => pathname === c.href)
  const [open, setOpen] = useState(isChildActive)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={isChildActive ? { color: '#f5f5f5', backgroundColor: '#1a0a2e' } : {}}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isChildActive
            ? ''
            : 'hover:bg-[#1a0a2e]'
        }`}
        onMouseEnter={e => { if (!isChildActive) e.currentTarget.style.color = '#f5f5f5' }}
        onMouseLeave={e => { if (!isChildActive) e.currentTarget.style.color = '' }}
      >
        <div className="flex items-center gap-3" style={{ color: isChildActive ? '#f5f5f5' : '#9ca3af' }}>
          <span className="text-base">{group.emoji}</span>
          {group.label}
        </div>
        <span style={{ color: '#4a3060', fontSize: '12px' }} className={`transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5 pl-2" style={{ borderLeft: '1px solid #2a1a3e' }}>
          {group.children.map(child => {
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
                } : {
                  color: '#9ca3af',
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? '' : 'hover:bg-[#1a0a2e] hover:text-white'
                } font-medium`}
              >
                <span className="text-sm">{child.emoji}</span>
                {child.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      style={{
        backgroundColor: '#0a0a0a',
        borderRight: '1px solid #2a1a3e',
      }}
      className="w-60 flex flex-col shrink-0"
    >
      {/* Branding */}
      <div className="px-5 py-6" style={{ borderBottom: '1px solid #2a1a3e' }}>
        <div className="flex items-center gap-2">
          <div
            style={{ background: 'linear-gradient(135deg, #731494, #AE2BCF)' }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
          >
            G
          </div>
          <div>
            <div style={{ color: '#AE2BCF' }} className="font-bold text-sm leading-none">GYC</div>
            <div style={{ color: '#4a3060' }} className="text-xs mt-0.5">KPI Dashboard</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          if (item.group) {
            return <GroupItem key={item.label} group={item} pathname={pathname} />
          }
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
              } : {
                color: '#9ca3af',
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? '' : 'hover:bg-[#1a0a2e] hover:text-white'
              }`}
            >
              <span className="text-base">{item.emoji}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid #2a1a3e' }}>
        <p style={{ color: '#4a3060' }} className="text-xs">Grow Your Childcare</p>
      </div>
    </aside>
  )
}
