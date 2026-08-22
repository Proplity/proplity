'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Checkout } from '../components/Checkout';
import { PLANS } from '../components/PricingPage';

function resolvePlanPrice(plan: (typeof PLANS)[number]) {
  if (plan.priceLabel) return plan.priceLabel;
  return plan.monthlyPrice ? `₦${plan.monthlyPrice.toLocaleString()}` : '';
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get('plan');
  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[1];

  return (
    <Checkout
      plan={{
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
