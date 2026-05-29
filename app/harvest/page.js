import HarvestPageComponent from '@/components/HarvestPage'
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await requireUser(['admin', 'superadmin'])
  
  // Check if this is Lada - she gets a limited production-only view
  const isLada = user.email === 'lada@growyourcenter.com'
  
  return <HarvestPageComponent isLada={isLada} />
}
