import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/session';
import { DashboardChrome } from './DashboardChrome';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    redirect('/');
  }

  return <DashboardChrome>{children}</DashboardChrome>;
}
