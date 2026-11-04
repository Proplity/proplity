'use client';

import { useParams } from 'next/navigation';
import { AgreementDocument } from '@/app/components/AgreementDocument';

// Outside /dashboard and /admin on purpose, like receipts: every signed-in role opens an agreement
// here, and the page prints cleanly with no app chrome. The edge guard (proxy.ts) sends signed-out
// visitors to sign in and back; the API decides whose agreement it is.
export default function Page() {
  const { rentId } = useParams<{ rentId: string }>();
  return (
    <main className="min-h-screen bg-gray-50 print:bg-white">
      <AgreementDocument rentId={rentId} />
    </main>
  );
}
