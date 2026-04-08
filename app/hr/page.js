import HRPage from '@/components/HRPage'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireUser(['superadmin', 'admin'])
  return <HRPage />
}
