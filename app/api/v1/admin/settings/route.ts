import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { validateCSRF } from '@/lib/auth/csrf';
import { getSystemSettings } from '@/lib/systemSettings';

// Admin-only platform toggles, backed by the same SystemSettings singleton
// row the /setup wizard uses. GET never writes (findUnique + defaults, via
// getSystemSettings()) so it's a plain read even on a deployment that's
// never run /setup or the seed script; PATCH upserts.
export const GET = withAuth(
  async () => {
    try {
      const settings = await getSystemSettings();
      return NextResponse.json({ data: settings });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);

const updateSchema = z.object({
  autoCompleteMaintenanceOnInvoice: z.boolean(),
});

export const PATCH = withAuth(
  async (req) => {
    if (!validateCSRF(req)) {
      return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    }
    try {
      const validated = await validateBody(req, updateSchema);
      if (!validated.success) return validated.response;

      const settings = await prisma.systemSettings.upsert({
        where: { id: 'global' },
        update: validated.data,
        create: { id: 'global', ...validated.data },
      });
      return NextResponse.json({ data: settings });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
