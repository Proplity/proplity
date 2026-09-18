import { Suspense } from 'react';
import { MessagingPortal } from '../../components/MessagingPortal';

export default function Page() {
  return (
    <Suspense>
      <MessagingPortal />
    </Suspense>
  );
}
