import SalesPage from '@/components/SalesActivityPage'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireUser(['sales', 'ga', 'staff', 'admin', 'superadmin'])
  return <SalesPage />
}
