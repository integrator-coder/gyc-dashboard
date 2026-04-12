import ProjectionsPage from '@/components/ProjectionsPage'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireUser(['admin', 'superadmin'])
  return <ProjectionsPage />
}
