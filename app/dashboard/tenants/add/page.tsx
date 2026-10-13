import { Suspense } from 'react';
import { AddTenantForm } from '../../../components/AddTenantForm';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AddTenantForm />
    </Suspense>
  );
}
