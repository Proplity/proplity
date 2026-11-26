import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { AdminLoginClient } from './AdminLoginClient';

export const metadata: Metadata = {
  title: 'Admin sign in',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

// Outside the (console) route group on purpose: the console layout needs a session, this does not.
export default async function AdminLoginPage() {
  const session = await getServerSession();
  if (session?.role === 'ADMIN') redirect('/admin');
  return <AdminLoginClient />;
}
