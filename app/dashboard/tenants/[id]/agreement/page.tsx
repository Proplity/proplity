'use client';

import { useParams } from 'next/navigation';
import { AgreementBuilder } from '../../../../components/AgreementBuilder';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <AgreementBuilder rentId={id} />;
}
