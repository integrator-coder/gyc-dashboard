import { Metadata } from 'next';
import PrimroseHubClient from '@/components/PrimroseHubClient';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Primrose Brand Intelligence Hub | GYC Dashboard',
  description: 'Brand intelligence and account intelligence for GYC\'s Primrose Schools pilot partnership',
};

export default async function PrimrosePage() {
  await requireUser(['ga', 'cx', 'admin', 'superadmin', 'manager']);
  return <PrimroseHubClient />;
}
