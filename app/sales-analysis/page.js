import SalesAnalysisPage from '@/components/SalesAnalysisPage'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireUser(['staff', 'admin', 'superadmin'])
  return <SalesAnalysisPage />
}
