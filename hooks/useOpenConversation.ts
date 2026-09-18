import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useCreateConversation } from './useConversations';
import type { CreateConversationInput } from '@/lib/api/types';

// Every "Message X" button in the app was navigating straight to
// /dashboard/messages with no idea which thread to open -- the create
// endpoint already derives the right participants from a lease/maintenance
// request/property (see app/api/v1/conversations/route.ts), it just had no
// caller. This is that caller: create-or-reuse the thread (the API is
// idempotent per type+context) and jump straight into it.
export function useOpenConversation() {
  const router = useRouter();
  const { submit, submitting } = useCreateConversation();

  const open = async (input: CreateConversationInput) => {
    try {
      const conversation = await submit(input);
      router.push(`/dashboard/messages?c=${conversation.id}`);
    } catch {
      toast.error('Could not open the conversation. Please try again.');
    }
  };

  return { open, opening: submitting };
}
