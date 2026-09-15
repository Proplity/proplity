'use client';

import { useParams } from 'next/navigation';
import { VendorCreateInvoice } from '../../../../../components/VendorCreateInvoice';

export default function Page() {
  const { id } = useParams<{ id: string }>();

  return <VendorCreateInvoice jobId={id} />;
}
