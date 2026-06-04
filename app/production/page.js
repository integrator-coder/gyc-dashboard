import ProductionPage from '@/components/ProductionPage'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireUser(['ga', 'staff', 'admin', 'superadmin', 'manager'])
  return <ProductionPage />
}
