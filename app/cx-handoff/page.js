import CXHandoffPage from '@/components/CXHandoffPage'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await requireUser(['sales', 'ga', 'cx', 'admin'])
  return <CXHandoffPage user={serializeUser(user)} />
}
