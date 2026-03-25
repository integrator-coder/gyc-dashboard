import ClientBrowserPage from '@/components/ClientBrowserPage'
import { requireUser, serializeUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await requireUser(['ga', 'cx', 'admin'])
  return <ClientBrowserPage user={serializeUser(user)} />
}
