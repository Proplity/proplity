import { NextResponse } from 'next/server';
import { handleApiError } from './errors';
import { FileError } from '@/lib/storage/service';

/** FileError -> its HTTP status; anything else -> the standard handler. */
export function handleFileError(err: unknown) {
  if (err instanceof FileError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return handleApiError(err);
}
