import { Metadata } from 'next';
import PrimroseHubClient from '@/components/PrimroseHubClient';

export const metadata: Metadata = {
  title: 'Primrose Brand Intelligence Hub | GYC Dashboard',
  description: 'Brand intelligence and account intelligence for GYC\'s Primrose Schools pilot partnership',
};

export default function PrimrosePage() {
  return <PrimroseHubClient />;
}
