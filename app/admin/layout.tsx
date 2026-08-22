import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { AdminChrome } from './AdminChrome';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return <AdminChrome>{children}</AdminChrome>;
}
