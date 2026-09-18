import { useState } from 'react';
import { AxiosError } from 'axios';

function extractErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    return err.response?.data?.error ?? err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

// Shared submit/submitting/error shape for every write hook -- avoids
// re-deriving the same three lines of state in each of the 5 domain hooks.
//
// `submit` is a plain function, recreated every render -- it was previously
// wrapped in `useCallback(fn, [])`, which pins whatever `fn` closed over on
// the *first* render forever. That's invisible for hooks like
// useCreateConversation, whose `fn` only closes over the submitted body
// (module-level api.* call, no outer state). But hooks parameterized by
// something that changes after mount -- useSendMessage(conversationId) as
// the user switches conversations, useCreateAdCampaign(propertyId) as a
// different property's modal opens -- kept sending to whatever id was
// current on that first render (often '' before state settled), 404ing
// silently forever after. Confirmed live: MessagingPortal's send button
// never worked past the first render. A few extra function allocations
// per render is worth being correct.
export function useApiSubmit<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (...args: Args) => {
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
  };

  return { submit, submitting, error };
}
