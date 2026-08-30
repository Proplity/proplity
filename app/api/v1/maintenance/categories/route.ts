import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';

// Public, like /properties -- both tenants (submitting a request) and admins
// (managing the list) need to read it, and it carries no sensitive data.
export async function GET(_req: NextRequest) {
  try {
    const categories = await prisma.maintenanceCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ data: categories });
  } catch (err) {
    return handleApiError(err);
  }
}

const createCategorySchema = z.object({ name: z.string().min(1) });

export const POST = withAuth(
  async (req) => {
    try {
      const validated = await validateBody(req, createCategorySchema);
      if (!validated.success) return validated.response;

      const category = await prisma.maintenanceCategory.create({ data: validated.data });
      return NextResponse.json({ data: category }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);

const patchCategorySchema = z.object({ id: z.string(), isActive: z.boolean() });

export const PATCH = withAuth(
  async (req) => {
    try {
      const validated = await validateBody(req, patchCategorySchema);
      if (!validated.success) return validated.response;
      const { id, isActive } = validated.data;

      const category = await prisma.maintenanceCategory.update({
        where: { id },
        data: { isActive },
      });
      return NextResponse.json({ data: category });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
