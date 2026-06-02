import HarvestPageComponent from '@/components/HarvestPage'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await requireUser(['admin', 'superadmin'])
  
  return <HarvestPageComponent isLada={false} />
}
