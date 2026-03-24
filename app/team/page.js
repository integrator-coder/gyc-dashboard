import { redirect } from 'next/navigation'
import { requireUser, userHasRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function TeamHomePage() {
  const user = await requireUser(['sales', 'ga', 'cx', 'admin'])
  if (userHasRole(user, ['cx']) && !userHasRole(user, ['sales', 'ga'])) {
    redirect('/team/cx')
  }
  redirect('/team/classify')
}
