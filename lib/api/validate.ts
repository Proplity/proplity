import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const MAX_JSON_BYTES = 1_000_000;

export async function validateBody<T extends z.ZodType>(req: NextRequest, schema: T) {
  // Cap what a client can make us parse: no endpoint here takes more than 1 MB of JSON.
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_JSON_BYTES) {
    return {
      success: false as const,
      response: NextResponse.json({ error: 'Request body is too large' }, { status: 413 }),
    };
  }
  const text = await req.text().catch(() => '');
  if (text.length > MAX_JSON_BYTES) {
    return {
      success: false as const,
      response: NextResponse.json({ error: 'Request body is too large' }, { status: 413 }),
    };
  }
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
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
