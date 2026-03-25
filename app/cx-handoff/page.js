import CXHandoffPage from '@/components/CXHandoffPage'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireUser(['cx', 'admin'])
  return <CXHandoffPage />
}
