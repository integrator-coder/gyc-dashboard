import { requireUser, serializeUser } from '@/lib/auth'
import ToolkitConsolePage from '@/components/ToolkitConsolePage'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await requireUser(['sales', 'ga', 'cx', 'recon', 'admin', 'superadmin'])
  return <ToolkitConsolePage user={serializeUser(user)} />
}
