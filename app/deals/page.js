import ClosedDealsPage from '@/components/ClosedDealsPage'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Closed Deals — GYC Dashboard',
  description: 'Feed of all closed deals with client intel and financials.',
}

export default async function Page() {
  await requireUser(['sales', 'ga', 'staff', 'cx', 'admin', 'superadmin', 'manager'])
  return <ClosedDealsPage />
}
