'use client';

import { Suspense } from 'react';
import { AccountSettings } from '../../components/AccountSettings';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading settings…</div>}>
      <AccountSettings />
    </Suspense>
  );
}
