import { afterEach, describe, expect, it } from 'vitest';
import { buildContactEmail, contactRecipient, contactSchema, messageWentOut } from '@/lib/contact';

const valid = {
  firstName: 'Ada',
  lastName: 'Obi',
  email: 'Ada.Obi@Example.com',
  message: 'We manage 40 flats in Lekki and want to see how rent collection works.',
};

describe('the contact form message', () => {
  it('accepts a normal message, lowercases the email and fills the optional fields', () => {
    const parsed = contactSchema.parse(valid);
    expect(parsed.email).toBe('ada.obi@example.com');
    expect(parsed.company).toBe('');
    expect(parsed.helpTopic).toBe('');
    expect(parsed.website).toBe('');
  });

  it('refuses a missing name, a bad email and a message too short to be one', () => {
    expect(contactSchema.safeParse({ ...valid, firstName: '  ' }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, lastName: '' }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, message: 'hi' }).success).toBe(false);
  });

  it('caps the message so the form cannot be used to send an essay', () => {
    expect(contactSchema.safeParse({ ...valid, message: 'x'.repeat(5001) }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, message: 'x'.repeat(5000) }).success).toBe(true);
  });
});

describe('the email sent to the team', () => {
  it('names the topic and the sender and carries the whole message', () => {
    const { subject, body } = buildContactEmail(
      contactSchema.parse({
        ...valid,
        company: 'Obi Estates',
        portfolioSize: '11-50 units',
        helpTopic: 'Pricing',
      }),
    );
    expect(subject).toBe('Contact form: Pricing (Ada Obi)');
    expect(body).toContain('Email: ada.obi@example.com');
    expect(body).toContain('Company: Obi Estates');
    expect(body).toContain('Portfolio size: 11-50 units');
    expect(body).toContain(valid.message);
  });

  it('leaves out what was not filled in, and defaults the topic', () => {
    const { subject, body } = buildContactEmail(contactSchema.parse(valid));
    expect(subject).toBe('Contact form: General enquiry (Ada Obi)');
    expect(body).not.toContain('Company:');
    expect(body).not.toContain('Portfolio size:');
  });

  it('keeps line breaks out of the subject', () => {
    const { subject } = buildContactEmail(
      contactSchema.parse({ ...valid, firstName: 'Ada\r\nBcc: someone@example.com' }),
    );
    expect(subject).not.toMatch(/[\r\n]/);
  });
});

describe('where contact messages go', () => {
  const original = process.env.CONTACT_EMAIL;
  afterEach(() => {
    if (original === undefined) delete process.env.CONTACT_EMAIL;
    else process.env.CONTACT_EMAIL = original;
  });

  it('is the CONTACT_EMAIL address, lowercased', () => {
    process.env.CONTACT_EMAIL = ' Hello@Proplity.com ';
    expect(contactRecipient()).toBe('hello@proplity.com');
  });

  it('is nothing when the variable is unset or not an email', () => {
    delete process.env.CONTACT_EMAIL;
    expect(contactRecipient()).toBeNull();
    process.env.CONTACT_EMAIL = 'not an address';
    expect(contactRecipient()).toBeNull();
  });
});

describe('telling the visitor their message was sent', () => {
  it('is true when the email was delivered', () => {
    expect(messageWentOut({ delivered: true, hasApiKey: true, production: true })).toBe(true);
  });

  it('is true on a developer machine with no email key, where the console is the inbox', () => {
    expect(messageWentOut({ delivered: false, hasApiKey: false, production: false })).toBe(true);
  });

  it('is false on a real deployment with no email key: the message would be lost', () => {
    expect(messageWentOut({ delivered: false, hasApiKey: false, production: true })).toBe(false);
  });

  it('is false when the provider refused it, however the app is run', () => {
    expect(messageWentOut({ delivered: false, hasApiKey: true, production: false })).toBe(false);
    expect(messageWentOut({ delivered: false, hasApiKey: true, production: true })).toBe(false);
  });
});
