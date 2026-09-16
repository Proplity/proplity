import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { SetupWizardForm } from './SetupWizardForm';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'global' },
    });

    // If setup is already finished, redirect directly on the server (no client flash)
    if (settings?.setupComplete) {
      redirect('/login');
    }
  } catch (err: any) {
    // Crucial: Next.js redirect() throws a NEXT_REDIRECT error that must be re-thrown
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    // Fail-open on DB connection issues so deployers can still access the wizard
    console.error('[SETUP_SERVER_CHECK_ERROR]', err);
  }

  const requiresToken = Boolean(process.env.SETUP_TOKEN);

  return <SetupWizardForm requiresToken={requiresToken} />;
}
