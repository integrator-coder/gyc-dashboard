import { requireUser } from '@/lib/auth'
import Link from 'next/link'
import SkunkWorksBoard from '@/components/SkunkWorksBoard'

export const dynamic = 'force-dynamic'

export default async function SkunkWorksPage() {
  await requireUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin'])
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a1030_0%,#09090c_42%,#040405_100%)] px-6 py-8 text-white">
      <div className="mx-auto mb-6 flex max-w-[1550px] justify-end">
        <Link
          href="/team/mission-control"
          className="rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25"
        >
          ← Back to Mission Control
        </Link>
      </div>
      <div className="mx-auto max-w-[1550px]">
        <SkunkWorksBoard />
      </div>
    </div>
  )
}
