import { requireUser } from '@/lib/auth'
import CXHandoffPage from '@/components/CXHandoffPage'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireUser(['cx', 'admin'])
  return <CXHandoffPage />
}
