import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleFileError } from '@/lib/api/fileErrors';
import { completeDirectUpload } from '@/lib/storage/service';

// Step 2 for direct providers (Cloudinary, S3-compatible): the browser says it
// finished; the server verifies the object and marks the file READY. `claimed`
// relays the provider's own upload response and is only used where the
// provider cannot be asked (Cloudinary), after being checked against what the
// signature allowed.
const completeSchema = z.object({
  fileId: z.string().uuid(),
  claimed: z.record(z.string(), z.unknown()).default({}),
});

export const POST = withAuth(async (req, { session }) => {
  try {
    const validated = await validateBody(req, completeSchema);
    if (!validated.success) return validated.response;
    const stored = await completeDirectUpload(
      session,
      validated.data.fileId,
      validated.data.claimed,
    );
    return NextResponse.json({ data: stored });
  } catch (err) {
    return handleFileError(err);
  }
});
