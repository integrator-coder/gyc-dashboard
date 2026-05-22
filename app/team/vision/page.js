import { requireUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import VisionBoard from '@/components/VisionBoard'

export const metadata = {
  title: 'Vision Board — GYC Mission Control',
}

export default async function VisionPage() {
  const auth = await requireUser(['superadmin'])
  if (auth?.redirect) redirect(auth.redirect)

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#110820,#030305)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1400px]">
        <VisionBoard />
      </div>
    </main>
  )
}
