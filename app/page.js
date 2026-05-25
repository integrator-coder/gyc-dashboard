import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'

export default async function Home() {
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  // Role-based default landing pages
  if (['superadmin', 'admin'].includes(user.role)) {
    redirect('/leadership')
  }

  if (user.role === 'sales') {
    redirect('/sales-activity')
  }

  if (user.role === 'ga') {
    redirect('/cx')
  }

  // Fallback
  redirect('/sales-activity')
}
