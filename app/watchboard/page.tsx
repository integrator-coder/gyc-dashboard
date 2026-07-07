import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import WatchBoardClient from '@/components/WatchBoardClient';

export const dynamic = 'force-dynamic';

const ALLOWED_EMAILS = [
  'todd@growyourcenter.com',
  'bruce@growyourcenter.com',
  'zac@growyourcenter.com'
];

export default async function WatchBoardPage() {
  const user = await getSessionUser();
  
  if (!user) {
    redirect('/login');
  }
  
  if (!ALLOWED_EMAILS.includes(user.email)) {
    redirect('/leadership');
  }
  
  // Fetch all data server-side
  const [variables, companies, suspicions, snapshot] = await Promise.all([
    prisma.aIWatchVariable.findMany({
      where: { tenantId: 'gyc' },
      orderBy: [{ category: 'asc' }, { label: 'asc' }]
    }),
    prisma.aIWatchCompany.findMany({
      where: { tenantId: 'gyc' },
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    }),
    prisma.aIWatchSuspicion.findMany({
      where: { tenantId: 'gyc', isActive: true },
      orderBy: { detectedAt: 'desc' }
    }),
    prisma.aIWatchSnapshot.findFirst({
      where: { tenantId: 'gyc' },
      orderBy: { snapshotAt: 'desc' }
    })
  ]);
  
  return (
    <WatchBoardClient
      variables={JSON.parse(JSON.stringify(variables))}
      companies={JSON.parse(JSON.stringify(companies))}
      suspicions={JSON.parse(JSON.stringify(suspicions))}
      snapshot={snapshot ? JSON.parse(JSON.stringify(snapshot)) : null}
    />
  );
}
