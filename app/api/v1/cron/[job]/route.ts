import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/workers/auth';
import { runRentInvoicer } from '@/lib/workers/rentInvoicer';
import { runOverdueFlagger } from '@/lib/workers/overdueFlagger';
import { runMaintenanceScheduleDispatcher } from '@/lib/workers/maintenanceScheduleDispatcher';
import { runAccessCodeExpiryJanitor } from '@/lib/workers/accessCodeExpiryJanitor';
import { runPaymentReliabilityScorer } from '@/lib/workers/paymentReliabilityScorer';
import { handleApiError } from '@/lib/api/errors';

// One route, dispatched by :job -- lets any external scheduler (Vercel
// Cron, a system crontab calling curl, a GitHub Actions workflow) trigger
// a specific worker without this app needing to know which one is used.
const JOBS: Record<string, () => Promise<unknown>> = {
  'rent-invoicer': runRentInvoicer,
  'overdue-flagger': runOverdueFlagger,
  'maintenance-schedule-dispatcher': runMaintenanceScheduleDispatcher,
  'access-code-expiry-janitor': runAccessCodeExpiryJanitor,
  'payment-reliability-scorer': runPaymentReliabilityScorer,
};

type RouteCtx = { params: Promise<{ job: string }> };

export async function POST(req: NextRequest, { params }: RouteCtx) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { job } = await params;
  const run = JOBS[job];
  if (!run) {
    return NextResponse.json({ error: `Unknown job: ${job}`, knownJobs: Object.keys(JOBS) }, { status: 404 });
  }

  try {
    const result = await run();
    return NextResponse.json({ job, result });
  } catch (err) {
    return handleApiError(err);
  }
}
