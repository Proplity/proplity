import { cleanupStalePending } from '@/lib/storage/service';

/** Remove uploads that were signed but never completed (older than 24 h). */
export async function runStorageJanitor(): Promise<{ removed: number }> {
  return { removed: await cleanupStalePending() };
}
