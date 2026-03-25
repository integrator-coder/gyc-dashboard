import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function TeamHomePage() {
  await requireUser(['sales', 'ga', 'cx', 'admin'])
  redirect('/cx-handoff')
}
