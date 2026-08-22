import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

export function handleApiError(err: unknown) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002')
      return NextResponse.json({ error: 'Duplicate record', code: 'P2002' }, { status: 409 });
    if (err.code === 'P2025')
      return NextResponse.json({ error: 'Record not found', code: 'P2025' }, { status: 404 });
    if (err.code === 'P2003')
      return NextResponse.json({ error: 'Invalid reference', code: 'P2003' }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
