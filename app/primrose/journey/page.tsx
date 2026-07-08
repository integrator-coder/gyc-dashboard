import React from 'react';
import PrimroseJourneyClient from '@/components/PrimroseJourneyClient';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Kate Latham Journey | Primrose | GYC Dashboard',
  description: 'From first client to corporate pilot — how GYC won Primrose',
};

export default async function PrimroseJourneyPage() {
  await requireUser(['ga', 'cx', 'admin', 'superadmin', 'manager']);
  return <PrimroseJourneyClient />;
}
