import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api/errors';
import { listPlans } from '@/lib/plans';

// The plans a visitor can choose from, for the pricing page. Public, and only what the admin has
// switched on.
export async function GET() {
  try {
    return NextResponse.json({ data: await listPlans({ onlyActive: true }) });
  } catch (err) {
    return handleApiError(err);
  }
}
