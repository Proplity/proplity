import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { toCsv } from '@/lib/csv';
import { toXlsx } from '@/lib/xlsx';

const COLUMNS = [
  'propertyName',
  'address',
  'city',
  'state',
  'unitNumber',
  'bedrooms',
  'bathrooms',
  'sqft',
  'rentAmount',
  'listedPaymentFrequency',
  'unitStatus',
  'tenantName',
  'tenantEmail',
];

// One row per unit -- the same "Property & Unit Management" data PRD §5.1's
// import/export bullet is about. Scoped exactly like GET /properties?scope=mine:
// ADMIN sees everything, MANAGER/LANDLORD see only their own properties.
export const GET = withAuth(
  async (req, { session }) => {
    try {
      const format = req.nextUrl.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';

      const where =
        session.role === 'ADMIN'
          ? {}
          : { OR: [{ managerId: session.sub }, { landlordId: session.sub }] };

      const properties = await prisma.property.findMany({
        where,
        include: {
          units: {
            include: {
              leases: {
                where: { status: 'ACTIVE' },
                include: { tenant: { select: { name: true, email: true } } },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const rows = properties.flatMap((property) =>
        property.units.map((unit) => {
          const tenant = unit.leases[0]?.tenant;
          return {
            propertyName: property.name,
            address: property.address,
            city: property.city,
            state: property.state,
            unitNumber: unit.unitNumber,
            bedrooms: unit.bedrooms,
            bathrooms: unit.bathrooms,
            sqft: unit.squareFeet ?? '',
            rentAmount: unit.rentAmount,
            listedPaymentFrequency: unit.listedPaymentFrequency,
            unitStatus: unit.status,
            tenantName: tenant?.name ?? '',
            tenantEmail: tenant?.email ?? '',
          };
        }),
      );

      const filename = `proplity-properties-export.${format}`;

      if (format === 'xlsx') {
        const buffer = await toXlsx(rows, COLUMNS, 'Properties');
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        });
      }

      const csv = toCsv(rows, COLUMNS);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
