import { requireUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ZoomClassifierPage from '@/components/ZoomClassifierPage'

export const metadata = {
  title: 'Call Intelligence — GYC Dashboard',
}

export default async function ZoomPage() {
  const user = await requireUser(['superadmin', 'admin'])
  if (!user) redirect('/login')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <ZoomClassifierPage />
    </div>
  )
}
