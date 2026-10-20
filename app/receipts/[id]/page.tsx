'use client';

import { useParams } from 'next/navigation';
import { ReceiptView } from '@/app/components/ReceiptView';

// Outside /dashboard and /admin on purpose: every signed-in role opens receipts here, and the page
// prints cleanly with no app chrome. The edge guard (proxy.ts) sends signed-out visitors to sign in
// and back; the API decides whose receipt it is.
export default function Page() {
  const { id } = useParams<{ id: string }>();
  return (
    <main className="min-h-screen bg-gray-50 print:bg-white">
      <ReceiptView paymentId={id} />
    </main>
  );
}
