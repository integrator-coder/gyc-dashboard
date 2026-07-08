import MarketingPageClient from '@/components/MarketingPageClient'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireUser(['ga', 'cx', 'admin', 'superadmin', 'manager'])
  return <MarketingPageClient />
}
