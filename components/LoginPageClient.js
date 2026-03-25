'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

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

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center px-4">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.2fr_420px]">
        <div className="rounded-3xl border border-[var(--brand-border)] bg-[radial-gradient(circle_at_top_left,rgba(174,43,207,0.16),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] p-8 lg:p-10">
          <div className="text-sm font-semibold uppercase tracking-[0.32em] text-violet-300">GYC Team Portal</div>
          <h1 className="mt-4 text-4xl font-bold text-white">Classify calls, review handoffs, and search transcripts.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-gray-300">
            Lightweight internal access for Sales, GA, CX, and admin reviewers. Built on the existing Neon call intelligence tables.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ['Sales / GA', 'Review only your pending call classifications.'],
              ['CX', 'Review handoffs and ask transcript questions fast.'],
              ['Admin', 'See both sides of the workflow with full access.'],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-2xl border border-[var(--brand-border)] bg-black/25 p-4">
                <div className="text-sm font-semibold text-white">{title}</div>
                <div className="mt-2 text-sm leading-6 text-gray-400">{copy}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-bg-card)] p-8 shadow-2xl shadow-violet-950/20">
          <div className="text-2xl font-bold text-white">Log in</div>
          <p className="mt-2 text-sm text-gray-400">Use your GYC team account to open the portal.</p>

          {message ? (
            <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <div className="mb-2 text-sm font-medium text-gray-300">Email</div>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="name@growyourcenter.com" className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500/50" required />
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-medium text-gray-300">Password</div>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" className="w-full rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-bg)] px-4 py-3 text-white outline-none transition focus:border-violet-500/50" required />
            </label>

            <button type="submit" disabled={loading} className="w-full rounded-2xl bg-[var(--brand-primary-2)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-3)] disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
