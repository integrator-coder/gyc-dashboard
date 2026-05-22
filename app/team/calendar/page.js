import { requireUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import CalendarPlaybooksBoard from '@/components/CalendarPlaybooksBoard'

export const metadata = {
  title: 'Calendar & Meeting Playbooks — GYC Mission Control',
}

export default async function CalendarPage() {
  const auth = await requireUser(['admin', 'superadmin'])
  if (auth?.redirect) redirect(auth.redirect)

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#0d0d1a,#030305)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1400px]">
        <CalendarPlaybooksBoard />
      </div>
    </main>
  )
}
