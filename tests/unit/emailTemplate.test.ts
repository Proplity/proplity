import { describe, it, expect } from 'vitest';
import { renderEmailHtml, ctaLabel, escapeHtml } from '@/lib/emailTemplate';

const RESET_BODY =
  "Hi Ada,\n\nWe received a request to reset your Proplity password. Click the link below to choose a new one:\n\nhttps://app.example.com/reset-password?token=abc123&x=1\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.";

describe('renderEmailHtml', () => {
  const html = renderEmailHtml({ subject: 'Reset your Proplity password', body: RESET_BODY });

  it('is a complete document with the subject as title and heading', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Reset your Proplity password</title>');
    expect(html).toContain('>Reset your Proplity password</h1>');
  });

  it('turns a link-only paragraph into a labelled button and a paste-able fallback', () => {
    expect(html).toContain('Choose a new password</a>');
    // the & is escaped inside the attribute, and the link appears three times (button href, fallback href, fallback text)
    expect(html.match(/token=abc123&amp;x=1/g)?.length).toBe(3);
    expect(html).toContain('Button not working?');
  });

  it('moves the closing "ignore this email" sentence into the quiet note', () => {
    expect(html).toContain('This link expires in 1 hour.');
    expect(html.indexOf('This link expires')).toBeGreaterThan(
      html.indexOf('Choose a new password'),
    );
  });

  it('never inserts body text as markup', () => {
    const evil = renderEmailHtml({
      subject: '<script>alert(1)</script>',
      body: 'Hi <b>x</b>,\n\n<img src=x onerror=alert(1)>\n\nhttps://a.example/"onmouseover="alert(1)',
    });
    expect(evil).not.toContain('<script>alert');
    expect(evil).not.toContain('<img src=x');
    expect(evil).not.toContain('<b>x</b>');
    expect(evil).not.toMatch(/href="[^"]*"onmouseover/);
  });

  it('renders "- " lines as a list and links inline URLs', () => {
    const out = renderEmailHtml({
      subject: 'Update',
      body: 'Hi Bo,\n\n- Rent is due\n- Repair booked\n\nDetails at https://app.example.com/dashboard.',
    });
    expect(out).toContain('<ul');
    expect(out.match(/<li /g)?.length).toBe(2);
    expect(out).toContain('href="https://app.example.com/dashboard"');
  });

  it('handles a body with a single paragraph and no note', () => {
    const out = renderEmailHtml({ subject: 'Hello', body: 'Just one line.' });
    expect(out).toContain('Just one line.');
    expect(out).not.toContain('Button not working?');
  });
});

describe('ctaLabel', () => {
  it.each([
    ['https://x.test/reset-password?token=1', 'Choose a new password'],
    ['https://x.test/verify-email?token=1', 'Confirm my email'],
    ['https://x.test/witness/abc', 'Review and sign'],
    ['https://x.test/dashboard/properties/1', 'View the property'],
    ['https://x.test/dashboard', 'Open my dashboard'],
    ['https://x.test/elsewhere', 'Open Proplity'],
    ['not a url', 'Open Proplity'],
  ])('%s -> %s', (url, label) => {
    expect(ctaLabel(url)).toBe(label);
  });
});

describe('escapeHtml', () => {
  it('escapes the five characters that matter', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
    );
  });
});
