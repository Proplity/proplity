'use client';

import { Suspense } from 'react';
import { CompleteProfileForm } from '@/app/components/CompleteProfileForm';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CompleteProfileForm />
    </Suspense>
  );
}
