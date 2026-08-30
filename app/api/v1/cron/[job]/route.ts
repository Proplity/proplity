import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/workers/auth';
import { runRentInvoicer } from '@/lib/workers/rentInvoicer';
import { runOverdueFlagger } from '@/lib/workers/overdueFlagger';
import { runMaintenanceScheduleDispatcher } from '@/lib/workers/maintenanceScheduleDispatcher';
import { runAccessCodeExpiryJanitor } from '@/lib/workers/accessCodeExpiryJanitor';
import { runPaymentReliabilityScorer } from '@/lib/workers/paymentReliabilityScorer';
import { handleApiError } from '@/lib/api/errors';

// Never prerender or cache: this route mutates the database on every call.
export const dynamic = 'force-dynamic';
// Workers sweep whole tables; the default 10s is not enough once there is
// real data. 60s is the ceiling on Vercel's Hobby plan (Pro allows 300).
export const maxDuration = 60;

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

// Order matters: invoicing must create the cycle's invoices before the
// overdue flagger judges what is late, and both must land before payment
// reliability is rescored from that same invoice history.
const ALL_JOBS_IN_ORDER = [
  'rent-invoicer',
  'overdue-flagger',
  'maintenance-schedule-dispatcher',
  'access-code-expiry-janitor',
  'payment-reliability-scorer',
] as const;

/**
 * Runs every worker in dependency order. Exists because Vercel's Hobby plan
 * allows only 2 cron jobs at once-a-day granularity -- far fewer than the 5
 * workers -- so a single daily schedule fans out to all of them here.
 *
 * One worker failing does NOT abort the rest: they are independent sweeps,
 * and letting a rent-invoicer outage also silently skip the access-code
 * janitor would turn one broken job into five. Failures are collected and
 * reported, and the response is a 500 if any job failed, so the platform's
 * cron log surfaces it instead of showing a green run.
 */
async function runAllJobs() {
  const results: Record<string, unknown> = {};
  const failures: Record<string, string> = {};

  for (const name of ALL_JOBS_IN_ORDER) {
    try {
      results[name] = await JOBS[name]();
    } catch (err) {
      failures[name] = err instanceof Error ? err.message : String(err);
      console.error(`[cron] job "${name}" failed:`, err);
    }
  }

  return { results, failures };
}

type RouteCtx = { params: Promise<{ job: string }> };

async function handle(req: NextRequest, { params }: RouteCtx) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { job } = await params;

  if (job === 'all') {
    const { results, failures } = await runAllJobs();
    const failed = Object.keys(failures);
    return NextResponse.json(
      { job: 'all', ran: ALL_JOBS_IN_ORDER, results, failures },
      { status: failed.length ? 500 : 200 },
    );
  }

  const run = JOBS[job];
  if (!run) {
    return NextResponse.json(
      { error: `Unknown job: ${job}`, knownJobs: [...Object.keys(JOBS), 'all'] },
      { status: 404 },
    );
  }

  try {
    const result = await run();
    return NextResponse.json({ job, result });
  } catch (err) {
    return handleApiError(err);
  }
}

// Vercel Cron issues GET only, and its schedule/URL are fixed in vercel.json.
export async function GET(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx);
}

// POST is the original contract -- crontab/curl, CI, and the test suite.
export async function POST(req: NextRequest, ctx: RouteCtx) {
  return handle(req, ctx);
}
