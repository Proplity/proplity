'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Checkout } from '../components/Checkout';
import { PLANS } from '../components/PricingPage';
import { subscriptionsEnabled } from '@/lib/subscriptions';

function resolvePlanPrice(plan: (typeof PLANS)[number]) {
  if (plan.priceLabel) return plan.priceLabel;
  return plan.monthlyPrice ? `₦${plan.monthlyPrice.toLocaleString()}` : '';
}

// PricingPage's plan ids -> the real Subscription.tier values the backend
// understands. 'enterprise' never reaches this page (its CTA routes to
// onGetStarted, not onSelectPlan/checkout) -- defaulted to PRO here only as
// a defensive fallback, not an expected path.
function resolveTier(planId: string): 'FREE' | 'PRO' {
  return planId === 'starter' ? 'FREE' : 'PRO';
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get('plan');
  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[1];

  useEffect(() => {
    if (!subscriptionsEnabled()) {
      router.replace('/pricing');
    }
  }, [router]);

  if (!subscriptionsEnabled()) return null;

  return (
    <Checkout
      plan={{
        tier: resolveTier(plan.id),
        name: plan.name,
        price: resolvePlanPrice(plan),
        units: plan.units,
        features: plan.features,
      }}
      onBack={() => router.push(`/register?plan=${plan.id}`)}
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
