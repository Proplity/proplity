import { z } from 'zod';
import { emailSchema } from '@/lib/auth/email';

// The contact page's message to the Proplity team. Public (no sign-in), so everything here is
// bounded: the longest field is the message, and the honeypot `website` field is for bots.
export const contactSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  email: emailSchema,
  company: z.string().trim().max(120).optional().default(''),
  portfolioSize: z.string().trim().max(60).optional().default(''),
  helpTopic: z.string().trim().max(80).optional().default(''),
  message: z.string().trim().min(10, 'Please write a few words').max(5000),
  // Hidden in the form; a person never fills it in.
  website: z.string().max(200).optional().default(''),
});

export type ContactInput = z.infer<typeof contactSchema>;

/** Where contact messages go (`CONTACT_EMAIL`), or null when none is set. */
export function contactRecipient(): string | null {
  const parsed = emailSchema.safeParse(process.env.CONTACT_EMAIL ?? '');
  return parsed.success ? parsed.data : null;
}

// A value that ends up in a subject line must not carry line breaks.
const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();

export function buildContactEmail(input: ContactInput): { subject: string; body: string } {
  const name = oneLine(`${input.firstName} ${input.lastName}`);
  const topic = oneLine(input.helpTopic) || 'General enquiry';
  const lines = [
    `Name: ${name}`,
    `Email: ${input.email}`,
    ...(input.company ? [`Company: ${oneLine(input.company)}`] : []),
    ...(input.portfolioSize ? [`Portfolio size: ${oneLine(input.portfolioSize)}`] : []),
    `Topic: ${topic}`,
    '',
    input.message,
    '',
    '(Sent from the contact form on the Proplity website. Reply to this email to answer.)',
  ];
  return { subject: `Contact form: ${topic} (${name})`, body: lines.join('\n') };
}

/**
 * Whether the visitor may be told their message was sent. Only when the email went out, or when it
 * could only go to the console on a developer's machine (no `RESEND_API_KEY`, not production). On
 * a real deployment a console-only message is lost, so that is a refusal, not a success.
 */
export function messageWentOut({
  delivered,
  hasApiKey,
  production,
}: {
  delivered: boolean;
  hasApiKey: boolean;
  production: boolean;
}): boolean {
  return delivered || (!hasApiKey && !production);
}
