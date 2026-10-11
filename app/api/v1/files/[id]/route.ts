import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from '@/lib/auth/session';
import { handleApiError } from '@/lib/api/errors';
import { parseFileUrl } from '@/lib/fileRef';
import { auditFile, canReadFile, resolveForRead } from '@/lib/storage/service';
import { isInlineSafe } from '@/lib/uploadPolicy';
import type { Role } from '@prisma/client';

// The one door to every uploaded file (ADR-0010). Model fields store
// `/api/v1/files/<id>`; this decides who may read it and serves it from the
// provider recorded on the file's own row.
//   public  -> anyone
//   private -> the owner, an admin, or someone related to it (canReadFile);
//              everyone else gets 404 so ids can't be probed
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await ctx.params;
    const id = parseFileUrl(`/api/v1/files/${rawId}`);
    if (!id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const file = await prisma.storedFile.findUnique({ where: { id } });
    if (!file || file.status !== 'READY') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let actorId: string | null = null;
    if (file.access === 'private') {
      const session = await getServerSession();
      if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
      actorId = session.sub;
      if (!(await canReadFile({ sub: session.sub, role: session.role as Role }, file))) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    const result = await resolveForRead(file, actorId);
    if (result.kind === 'error') {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }
    if (file.access === 'private') await auditFile('FILE_READ', actorId, file);

    const cache =
      file.access === 'private'
        ? 'private, no-store'
        : 'public, max-age=60, stale-while-revalidate=300';
    if (result.kind === 'redirect') {
      const res = NextResponse.redirect(result.url, 302);
      res.headers.set('Cache-Control', cache);
      return res;
    }
    const type = result.contentType;
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': isInlineSafe(type) ? type : 'application/octet-stream',
        'Content-Disposition': isInlineSafe(type) ? 'inline' : 'attachment',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': cache,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
