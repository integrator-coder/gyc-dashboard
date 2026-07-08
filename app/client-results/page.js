import ClientResultsPageClient from '@/components/ClientResultsPageClient'
import { requireUser, serializeUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireUser(['ga', 'cx', 'admin', 'superadmin', 'manager'])
  return <ClientResultsPageClient />
}
