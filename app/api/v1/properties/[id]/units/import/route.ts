import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { parseCsv } from '@/lib/csv';
import { parseXlsx } from '@/lib/xlsx';
import { getSystemSettings } from '@/lib/systemSettings';
import { PlanLimitError, assertUnitCapacity } from '@/lib/plans';

type RouteCtx = { params: Promise<{ id: string }> };

const MAX_IMPORT_BYTES = 2_000_000;
const MAX_IMPORT_ROWS = 500;

// Required: unitNumber, rentAmount. Everything else optional, matching
// Unit's own schema defaults. One row failing (bad number, duplicate
// unitNumber) doesn't abort the rest -- each row is its own create, with
// per-row errors collected and returned rather than the whole import
// failing on the first bad row.
export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const property = await prisma.property.findUnique({ where: { id } });
      if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      if (!canManageProperty(session, property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

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
      const isXlsx = filename.toLowerCase().endsWith('.xlsx');
      const buffer = Buffer.from(await file.arrayBuffer());

      const rows = isXlsx ? await parseXlsx(buffer) : parseCsv(buffer.toString('utf-8'));
      if (rows.length === 0) {
        return NextResponse.json({ error: 'No data rows found in file' }, { status: 400 });
      }
      if (rows.length > MAX_IMPORT_ROWS) {
        return NextResponse.json(
          { error: `Import at most ${MAX_IMPORT_ROWS} units at a time` },
          { status: 400 },
        );
      }
      // Units added by an owner or manager wait for admin approval, same as adding one by hand.
      const pendingApproval = session.role === 'LANDLORD' || session.role === 'MANAGER';

      const errors: { row: number; error: string }[] = [];
      const toCreate: {
        propertyId: string;
        unitNumber: string;
        rentAmount: number;
        bedrooms?: number;
        bathrooms?: number;
        squareFeet?: number | null;
        amenities?: string[];
      }[] = [];
      const taken = new Set(
        (
          await prisma.unit.findMany({ where: { propertyId: id }, select: { unitNumber: true } })
        ).map((u) => u.unitNumber),
      );

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const unitNumber = (r.unitNumber ?? '').trim();
        const rentAmount = Number(r.rentAmount);

        if (!unitNumber) {
          errors.push({ row: i + 2, error: 'unitNumber is required' });
          continue;
        }
        if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
          errors.push({ row: i + 2, error: 'rentAmount must be a positive number' });
          continue;
        }
        if (taken.has(unitNumber)) {
          errors.push({
            row: i + 2,
            error: `Could not create unit "${unitNumber}" (duplicate unit number?)`,
          });
          continue;
        }
        taken.add(unitNumber);
        toCreate.push({
          propertyId: id,
          unitNumber,
          rentAmount,
          bedrooms: r.bedrooms ? Number(r.bedrooms) || 1 : undefined,
          bathrooms: r.bathrooms ? Number(r.bathrooms) || 1 : undefined,
          squareFeet: r.sqft ? Number(r.sqft) || null : undefined,
          ...(pendingApproval ? { amenities: ['approval:pending'] } : {}),
        });
      }

      // The plan's unit limit covers the whole file at once: it is all added or none of it is,
      // inside one transaction, so a limit cannot be passed halfway through a file.
      const settings = await getSystemSettings();
      const created = await prisma.$transaction(async (tx) => {
        await assertUnitCapacity(tx, {
          settings,
          property,
          adding: toCreate.length,
          actor: { id: session.sub, role: session.role },
          confirmOverage: formData.get('confirmOverage') === 'true',
        });
        const result = await tx.unit.createMany({ data: toCreate, skipDuplicates: true });
        return result.count;
      });

      return NextResponse.json({ data: { created, errors } }, { status: 201 });
    } catch (err) {
      if (err instanceof PlanLimitError) {
        return NextResponse.json(
          { error: err.message, code: err.code, ...err.details },
          { status: err.status },
        );
      }
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
