import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { parseCsv } from '@/lib/csv';
import { parseXlsx } from '@/lib/xlsx';
import { parsePortfolio } from '@/lib/portfolioImport';
import { ImportHasIssuesError, commitImport, previewImport } from '@/lib/portfolioImportRun';
import { PlanLimitError } from '@/lib/plans';
import { notifyAndEmail } from '@/lib/notifications';

const MAX_IMPORT_BYTES = 2_000_000;

// A spreadsheet of properties, their units and the tenant in each, for people who already manage
// a building and want it in Proplity without listing it. Everything it creates is kept for
// management only: never listed, never in the admin review queue. Send `preview=true` to see what
// it would do (and every problem) without saving; without it the file is saved, all or nothing.
// New tenants get a waiting account; their invitation emails go out separately, within the daily
// limit (POST /rents/invitations).
export const POST = withAuth(
  async (req, { session }) => {
    try {
      const formData = await req.formData();
      const file = formData.get('file');
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json({ error: 'A file field is required' }, { status: 400 });
      }
      if (file.size > MAX_IMPORT_BYTES) {
        return NextResponse.json(
          { error: 'The file is too large (2 MB at most)' },
          { status: 413 },
        );
      }

      const filename = 'name' in file ? String((file as File).name) : '';
      const buffer = Buffer.from(await file.arrayBuffer());
      const rows = filename.toLowerCase().endsWith('.xlsx')
        ? await parseXlsx(buffer)
        : parseCsv(buffer.toString('utf-8'));

      const parsed = parsePortfolio(rows, new Date());
      if (parsed.fileError) {
        return NextResponse.json({ error: parsed.fileError, code: 'BAD_FILE' }, { status: 400 });
      }

      if (formData.get('preview') === 'true') {
        return NextResponse.json({ data: await previewImport(session, parsed) });
      }

      const { summary, linkedTenantIds } = await commitImport(session, parsed, {
        confirmOverage: formData.get('confirmOverage') === 'true',
      });

      // People who already had an account hear about the new rent in the app; the others are
      // invited later.
      for (const tenantId of linkedTenantIds) {
        await notifyAndEmail(
          tenantId,
          {
            title: 'A rent was added for you',
            body: 'Your landlord or manager recorded a tenancy for you on Proplity. Open your dashboard to see it.',
            link: '/dashboard',
          },
          { email: false },
        );
      }

      return NextResponse.json({ data: { summary } }, { status: 201 });
    } catch (err) {
      if (err instanceof ImportHasIssuesError) {
        return NextResponse.json(
          {
            error: 'The file has problems. Nothing was saved.',
            code: 'IMPORT_HAS_ERRORS',
            issues: err.issues,
          },
          { status: 422 },
        );
      }
      if (err instanceof PlanLimitError) {
        return NextResponse.json(
          { error: err.message, code: err.code, ...err.details },
          { status: err.status },
        );
      }
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER', 'LANDLORD'] },
);
