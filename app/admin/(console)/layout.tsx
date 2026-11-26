import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { AdminChrome } from './AdminChrome';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  // Admins sign in on their own page; anyone else who lands here goes back to their dashboard.
  if (!session) redirect('/admin/login');
  if (session.role !== 'ADMIN') redirect('/dashboard');

  return <AdminChrome>{children}</AdminChrome>;
}
