import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export async function validateBody<T extends z.ZodType>(req: NextRequest, schema: T) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      success: false as const,
      response: NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.format() },
        { status: 400 },
      ),
    };
  }
  return { success: true as const, data: parsed.data as z.infer<T> };
}
