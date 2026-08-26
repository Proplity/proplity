import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { parseCsv } from '@/lib/csv';
import { parseXlsx } from '@/lib/xlsx';

type RouteCtx = { params: Promise<{ id: string }> };

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

      const filename = 'name' in file ? String((file as File).name) : '';
      const isXlsx = filename.toLowerCase().endsWith('.xlsx');
      const buffer = Buffer.from(await file.arrayBuffer());

      const rows = isXlsx ? await parseXlsx(buffer) : parseCsv(buffer.toString('utf-8'));
      if (rows.length === 0) {
        return NextResponse.json({ error: 'No data rows found in file' }, { status: 400 });
      }

      let created = 0;
      const errors: { row: number; error: string }[] = [];

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

        try {
          await prisma.unit.create({
            data: {
              propertyId: id,
              unitNumber,
              rentAmount,
              bedrooms: r.bedrooms ? Number(r.bedrooms) || 1 : undefined,
              bathrooms: r.bathrooms ? Number(r.bathrooms) || 1 : undefined,
              squareFeet: r.sqft ? Number(r.sqft) || null : undefined,
            },
          });
          created += 1;
        } catch {
          errors.push({ row: i + 2, error: `Could not create unit "${unitNumber}" (duplicate unit number?)` });
        }
      }

      return NextResponse.json({ data: { created, errors } }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
