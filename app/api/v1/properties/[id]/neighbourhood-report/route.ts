import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleApiError } from '@/lib/api/errors';

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const report = await prisma.neighbourhoodReport.findFirst({
      where: { propertyId: id },
      orderBy: { generatedAt: 'desc' },
    });
    if (!report)
      return NextResponse.json({ error: 'No neighbourhood report found' }, { status: 404 });
    return NextResponse.json({ data: report });
  } catch (err) {
    return handleApiError(err);
  }
}
