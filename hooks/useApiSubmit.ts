import { useCallback, useState } from 'react';
import { AxiosError } from 'axios';

function extractErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    return err.response?.data?.error ?? err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

// Shared submit/submitting/error shape for every write hook -- avoids
// re-deriving the same three lines of state in each of the 5 domain hooks.
export function useApiSubmit<Args extends unknown[], Result>(fn: (...args: Args) => Promise<Result>) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (...args: Args) => {
      setSubmitting(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (err) {
        setError(extractErrorMessage(err));
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    // fn is expected to be stable (module-level api.* calls); re-created
    // closures per-render would defeat useCallback's point here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { submit, submitting, error };
}
