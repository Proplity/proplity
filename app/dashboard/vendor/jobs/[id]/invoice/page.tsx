'use client';

import { useRouter, useParams } from 'next/navigation';
import { VendorCreateInvoice } from '../../../../../components/VendorCreateInvoice';

export default function Page() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  return <VendorCreateInvoice jobId={Number(id)} onBack={() => router.push('/dashboard')} />;
}
