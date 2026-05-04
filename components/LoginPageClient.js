'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

function RailIcon({ kind }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 18 18',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    className: 'text-violet-200/80',
  }

  switch (kind) {
    case 'sales':
      return (
        <svg {...common}>
          <path d="M2 12.5L6.2 8.3L9.1 11.2L15.5 4.8" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11.7 4.8H15.5V8.6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'cx':
      return (
        <svg {...common}>
          <circle cx="6" cy="9" r="2.6" stroke="currentColor" strokeWidth="1.35" />
          <circle cx="12" cy="9" r="2.6" stroke="currentColor" strokeWidth="1.35" />
          <path d="M8.4 9H9.6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
        </svg>
      )
    case 'finance':
      return (
        <svg {...common}>
          <path d="M4 4.5H14" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
          <path d="M4 9H14" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
          <path d="M4 13.5H10.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
          <circle cx="12.8" cy="13.4" r="1.6" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      )
    case 'leadership':
      return (
        <svg {...common}>
          <path d="M9 2.8L10.7 6.3L14.5 6.8L11.7 9.4L12.4 13.2L9 11.4L5.6 13.2L6.3 9.4L3.5 6.8L7.3 6.3L9 2.8Z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
        </svg>
      )
    default:
      return null
  }
}

export default function LoginPageClient({ message = '', nextUrl = '/cx-handoff' }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Login failed.')

      router.push(nextUrl)
      router.refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const accessItems = [
    { title: 'Sales', copy: 'Call outcomes, context, and follow-up risk.', kind: 'sales' },
    { title: 'CX', copy: 'Handoffs, transcript review, and follow-through.', kind: 'cx' },
    { title: 'Finance', copy: 'Stripe linkage review and billing cleanup.', kind: 'finance' },
    { title: 'Leadership', copy: 'Execution visibility across the system.', kind: 'leadership' },
  ]

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl items-center justify-center px-4 py-10 lg:px-6">
      <div className="w-full max-w-6xl overflow-hidden rounded-[30px] border border-white/7 bg-[linear-gradient(180deg,#0e121a_0%,#090c13_100%)] shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
        <div className="grid min-h-[680px] lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="px-8 py-9 lg:px-12 lg:py-11">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-violet-300/80">GYC Team Portal</div>

            <div className="mt-10 max-w-2xl">
              <h1 className="max-w-xl text-[1.85rem] font-semibold leading-[1.08] tracking-[-0.02em] text-white lg:text-[2.4rem]">
                Internal command center for client execution, operational clarity, and better decisions.
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-7 text-gray-300/82">
                Built for the people carrying GYC forward — Sales, CX, Finance, Ops, and leadership. Client context, workflow follow-through, transcript intelligence, and financial review are starting to live together in one place.
              </p>
            </div>

            <div className="mt-12 max-w-xl rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(30,36,48,0.72),rgba(16,20,29,0.88))] px-6 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[1.05rem] font-semibold text-white">Log in</div>
                  <p className="mt-1 text-sm leading-6 text-gray-400">Use your GYC team account to access the dashboard.</p>
                </div>
                <div className="mt-1 hidden h-px w-16 bg-[linear-gradient(90deg,rgba(139,92,246,0.55),rgba(255,255,255,0))] lg:block" />
              </div>

              {message ? (
                <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">{message}</div>
              ) : null}

              {error ? (
                <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">{error}</div>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
                <label className="block">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-gray-400">Email</div>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    autoComplete="email"
                    placeholder="name@growyourcenter.com"
                    className="w-full rounded-[15px] border border-white/9 bg-[rgba(10,14,22,0.9)] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-violet-500/35"
                    required
                  />
                </label>

                <label className="block">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-gray-400">Password</div>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    autoComplete="current-password"
                    className="w-full rounded-[15px] border border-white/9 bg-[rgba(10,14,22,0.9)] px-3.5 py-3 text-sm text-white outline-none transition focus:border-violet-500/35"
                    required
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full rounded-[15px] border border-violet-400/20 bg-[linear-gradient(135deg,rgba(88,28,135,0.94),rgba(55,48,163,0.88))] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Logging in…' : 'Log in'}
                </button>
              </form>
            </div>
          </section>

          <aside className="border-l border-white/7 bg-[linear-gradient(180deg,rgba(255,255,255,0.018),rgba(255,255,255,0.01))] px-5 py-9 lg:px-6 lg:py-11">
            <div className="flex h-full flex-col">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Access Index</div>
              <div className="mt-5 flex-1 space-y-1.5">
                {accessItems.map(({ title, copy, kind }) => (
                  <div key={title} className="border-t border-white/7 py-4 first:border-t-0 first:pt-0">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.025]">
                        <RailIcon kind={kind} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200/88">{title}</div>
                        <div className="mt-1.5 text-sm leading-6 text-gray-300/78">{copy}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/7 pt-4 text-[10px] uppercase tracking-[0.18em] text-gray-500">Internal use only</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
