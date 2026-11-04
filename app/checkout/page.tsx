'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Checkout } from '../components/Checkout';
import { subscriptionsEnabled } from '@/lib/subscriptions';
import { usePlans } from '@/hooks/usePlans';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planKey = searchParams.get('plan');
  const cycle = searchParams.get('cycle') === 'yearly' ? 'yearly' : 'monthly';
  const { data: plans, loading } = usePlans();

  useEffect(() => {
    if (!subscriptionsEnabled()) {
      router.replace('/');
    }
  }, [router]);

  if (!subscriptionsEnabled()) return null;
  if (loading) return null;

  // An old or mistyped link falls back to the most popular plan, then the first one.
  const plan =
    plans.find((p) => p.key === planKey) ?? plans.find((p) => p.isPopular) ?? plans[0] ?? null;
  if (!plan) {
    return <p className="p-10 text-center text-sm text-gray-600">No plans are available yet.</p>;
  }

  return (
    <Checkout
      plan={plan}
      initialCycle={cycle}
      onBack={() => router.push(`/register?plan=${plan.key}`)}
      onComplete={() => router.push('/dashboard')}
    />
  );
}

export default function Page() {
  return (
    <Suspense>
      <CheckoutContent />
    </Suspense>
  );
}
