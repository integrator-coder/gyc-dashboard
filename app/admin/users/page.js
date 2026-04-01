import AdminUsersClient from '@/components/AdminUsersClient'
import { requireUser, serializeUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const user = await requireUser(['admin', 'superadmin'])
  return <AdminUsersClient currentUser={serializeUser(user)} />
}
