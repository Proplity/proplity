import { redirect } from 'next/navigation';
import { subscriptionsEnabled } from '@/lib/subscriptions';
import { PricingPage } from '../components/PricingPage';

export default function Page() {
  if (!subscriptionsEnabled()) {
    redirect('/');
  }
  return <PricingPage />;
}
