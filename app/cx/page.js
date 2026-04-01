import CXPage from '@/components/CXPage'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireUser(['staff', 'admin', 'superadmin'])
  return <CXPage />
}
