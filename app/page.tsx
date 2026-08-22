import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { HomeLanding } from './HomeLanding';

export default async function Page() {
  const session = await getServerSession();
  if (session) {
    redirect(session.role === 'ADMIN' ? '/admin' : '/dashboard');
  }

  return <HomeLanding />;
}
