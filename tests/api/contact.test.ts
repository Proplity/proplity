import { beforeAll, describe, expect, it } from 'vitest';
import { apiFetch } from '../helpers/client';
import { resetDb } from '../helpers/db';
import { fillRateLimit } from '../helpers/fixtures';

// The contact page's form (ISS-133). The test server has CONTACT_EMAIL set and the dev email inbox
// on (tests/setup/globalSetup.ts), so what the route "sent" can be read back from the inbox.
// Each test uses its own client IP, because the route allows five messages an hour per address.

const TEAM = 'contact-inbox@proplity.test';

let nextIp = 0;
const freshIp = () => `198.51.100.${++nextIp}`;

const message = (marker: string, overrides: Record<string, unknown> = {}) => ({
  firstName: 'Ada',
  lastName: 'Obi',
  email: 'ada.obi@example.com',
  company: 'Obi Estates',
  portfolioSize: '11-50 units',
  helpTopic: 'Pricing',
  message: `We manage 40 flats and would like a demo. ${marker}`,
  ...overrides,
});

const send = (body: unknown, ip = freshIp(), headers: Record<string, string> = {}) =>
  apiFetch('/api/v1/contact', {
    method: 'POST',
    body,
    headers: { 'x-forwarded-for': ip, ...headers },
  });

type SentEmail = { to: string; subject: string; body: string };
const inbox = async () => (await apiFetch('/api/v1/dev/emails')).body.data as SentEmail[];

beforeAll(async () => {
  await resetDb();
});

describe('POST /contact', () => {
  it('emails the team and says so, with the visitor as the reply address', async () => {
    const marker = 'marker-delivered-1';
    const res = await send(message(marker));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const mine = (await inbox()).filter((e) => e.body.includes(marker));
    expect(mine).toHaveLength(1);
    expect(mine[0].to).toBe(TEAM);
    expect(mine[0].subject).toBe('Contact form: Pricing (Ada Obi)');
    expect(mine[0].body).toContain('ada.obi@example.com');
    expect(mine[0].body).toContain('Obi Estates');
  });

  it('refuses a message that is incomplete, and sends nothing', async () => {
    const marker = 'marker-invalid-1';
    const noName = await send(message(marker, { lastName: '' }));
    expect(noName.status).toBe(400);
    const badEmail = await send(message(marker, { email: 'nope' }));
    expect(badEmail.status).toBe(400);
    const tooShort = await send(message(marker, { message: 'hi' }));
    expect(tooShort.status).toBe(400);
    expect((await inbox()).filter((e) => e.body.includes(marker))).toHaveLength(0);
  });

  it('answers a bot that filled the hidden field as if it worked, and sends nothing', async () => {
    const marker = 'marker-bot-1';
    const res = await send(message(marker, { website: 'https://spam.example' }));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect((await inbox()).filter((e) => e.body.includes(marker))).toHaveLength(0);
  });

  it('keeps line breaks out of the subject line', async () => {
    const marker = 'marker-subject-1';
    const res = await send(message(marker, { firstName: 'Ada\r\nBcc: someone@example.com' }));
    expect(res.status).toBe(200);
    const mine = (await inbox()).filter((e) => e.body.includes(marker));
    expect(mine).toHaveLength(1);
    expect(mine[0].subject).not.toMatch(/[\r\n]/);
  });

  it('allows five messages an hour from one address, then says to wait', async () => {
    const ip = freshIp();
    await fillRateLimit(`contact:${ip}`, 5);
    const res = await send(message('marker-limited-1'), ip);
    expect(res.status).toBe(429);
    expect((await inbox()).filter((e) => e.body.includes('marker-limited-1'))).toHaveLength(0);
  });

  it('does not count one visitor against another', async () => {
    await fillRateLimit(`contact:${freshIp()}`, 5);
    const res = await send(message('marker-other-visitor-1'));
    expect(res.status).toBe(200);
  });

  it('refuses a request from another origin', async () => {
    const res = await send(message('marker-csrf-1'), freshIp(), {
      Origin: 'http://evil.example.com',
    });
    expect(res.status).toBe(403);
    expect((await inbox()).filter((e) => e.body.includes('marker-csrf-1'))).toHaveLength(0);
  });
});
