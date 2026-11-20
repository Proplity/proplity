// The HTML layout for every email Proplity sends.
//
// Callers pass plain text (subject + body) and `sendEmail` builds the HTML from it, so one layout
// covers all of them and the plain text stays the fallback part. The conventions the callers
// already follow are what this reads:
//   - paragraphs are separated by a blank line
//   - a paragraph that is only a link becomes the call-to-action button
//   - a paragraph whose lines all start with "- " or "• " becomes a list
//   - the closing "ignore this email / expires" sentence becomes a quiet note
// Everything is HTML-escaped; nothing from `body` is ever inserted as markup.

const INK = '#0b0b1f';
const PAGE = '#f3f4f7';
const CARD = '#ffffff';
const TEXT = '#2b2d3a';
const MUTED = '#6b7080';
const RULE = '#e6e8ee';
const LINK = '#1f4fd8';

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const URL_ONLY = /^https?:\/\/\S+$/;
const URL_INLINE = /https?:\/\/[^\s<>"]+/g;
const HAS_URL = /https?:\/\//;
const NOTE = /\b(ignore|didn['’]t request|did not request|expires?|safely)\b/i;

/** What the button says, from where it goes. Falls back to a plain "Open Proplity". */
export function ctaLabel(url: string): string {
  let path = '';
  try {
    path = new URL(url).pathname;
  } catch {
    return 'Open Proplity';
  }
  if (path.startsWith('/reset-password')) return 'Choose a new password';
  if (path.startsWith('/verify-email')) return 'Confirm my email';
  if (path.startsWith('/witness')) return 'Review and sign';
  if (path.startsWith('/register')) return 'Accept the invitation';
  if (path.startsWith('/admin')) return 'Open in the admin area';
  if (path.startsWith('/dashboard/maintenance')) return 'View the repair';
  if (path.startsWith('/dashboard/properties')) return 'View the property';
  if (path.startsWith('/dashboard')) return 'Open my dashboard';
  return 'Open Proplity';
}

/** Escapes text and turns bare links into anchors. Trailing punctuation stays outside the link. */
function linkify(text: string): string {
  let out = '';
  let last = 0;
  for (const match of text.matchAll(URL_INLINE)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const trimmed = raw.replace(/[.,;:!?)]+$/, '');
    out += escapeHtml(text.slice(last, start));
    out += `<a href="${escapeHtml(trimmed)}" style="color:${LINK};text-decoration:underline;">${escapeHtml(trimmed)}</a>`;
    out += escapeHtml(raw.slice(trimmed.length));
    last = start + raw.length;
  }
  out += escapeHtml(text.slice(last));
  return out;
}

function paragraphHtml(lines: string[]): string {
  return lines.map((line) => linkify(line)).join('<br>');
}

function button(url: string): string {
  const href = escapeHtml(url);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px 0;">
      <tr>
        <td align="center" bgcolor="${INK}" class="btn-cell" style="border-radius:10px;">
          <a href="${href}" class="btn" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(ctaLabel(url))}</a>
        </td>
      </tr>
    </table>
    <p class="muted" style="margin:14px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};">
      Button not working? Paste this link into your browser:
    </p>
    <p style="margin:6px 0 0 0;font-family:${MONO};font-size:12px;line-height:1.5;color:${MUTED};word-break:break-all;">
      <a href="${href}" style="color:${MUTED};text-decoration:underline;">${href}</a>
    </p>`;
}

export function renderEmailHtml({ subject, body }: { subject: string; body: string }): string {
  const paragraphs = body
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.split('\n').map((l) => l.trimEnd()))
    .filter((lines) => lines.some((l) => l.trim() !== ''));

  // The last paragraph is the quiet note when it is the "ignore this email" sort and has no link.
  let note: string[] | null = null;
  const last = paragraphs[paragraphs.length - 1];
  if (paragraphs.length > 1 && last && NOTE.test(last.join(' ')) && !HAS_URL.test(last.join(' '))) {
    note = last;
    paragraphs.pop();
  }

  const blocks = paragraphs.map((lines, index) => {
    const joined = lines.join(' ').trim();
    if (lines.length === 1 && URL_ONLY.test(joined)) return button(joined);

    if (lines.length > 0 && lines.every((l) => /^\s*(?:[-•*])\s+/.test(l))) {
      const items = lines
        .map(
          (l) => `<li style="margin:0 0 6px 0;">${linkify(l.replace(/^\s*(?:[-•*])\s+/, ''))}</li>`,
        )
        .join('');
      return `<ul style="margin:0 0 18px 0;padding:0 0 0 20px;font-family:${FONT};font-size:16px;line-height:1.6;color:${TEXT};">${items}</ul>`;
    }

    const greeting = index === 0 && /^(hi|hello|dear)\b.*,$/i.test(joined);
    return `<p style="margin:0 0 18px 0;font-family:${FONT};font-size:${greeting ? 17 : 16}px;line-height:1.6;color:${TEXT};${greeting ? 'font-weight:600;' : ''}">${paragraphHtml(lines)}</p>`;
  });

  const preheaderSource = paragraphs.find(
    (lines, i) => i > 0 || !/^(hi|hello|dear)\b/i.test(lines[0] ?? ''),
  );
  const preheader = escapeHtml((preheaderSource ?? [subject]).join(' ').slice(0, 110));

  const noteHtml = note
    ? `
      <tr><td style="padding:0 40px;"><div class="rule" style="border-top:1px solid ${RULE};height:1px;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>
      <tr><td class="pad" style="padding:20px 40px 32px 40px;">
        <p class="muted" style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">${paragraphHtml(note)}</p>
      </td></tr>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(subject)}</title>
<style>
  @media (max-width: 620px) {
    .shell { width: 100% !important; }
    .pad { padding-left: 24px !important; padding-right: 24px !important; }
    .outer { padding: 16px 12px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .page { background: #0c0d14 !important; }
    .card { background: #151722 !important; border-color: #2a2d3c !important; }
    .rule { border-color: #2a2d3c !important; }
    .mark { background: #f4f5fa !important; color: #0b0b1f !important; }
    .title, .brand { color: #f4f5fa !important; }
    p, li { color: #d6d8e3 !important; }
    .muted, .muted a { color: #9498aa !important; }
    .btn { color: #0b0b1f !important; }
    .btn-cell { background: #f4f5fa !important; }
  }
</style>
</head>
<body class="page" style="margin:0;padding:0;background:${PAGE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}&#8203;&zwnj;&#8203;&zwnj;&#8203;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="page" style="background:${PAGE};">
  <tr>
    <td align="center" class="outer" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" class="shell" style="width:560px;max-width:560px;">
        <tr>
          <td style="padding:0 4px 18px 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="32" height="32" align="center" valign="middle" bgcolor="${INK}" class="mark" style="width:32px;height:32px;border-radius:9px;font-family:${FONT};font-size:17px;font-weight:700;line-height:32px;color:#ffffff;">P</td>
                <td style="padding-left:10px;font-family:${FONT};font-size:19px;font-weight:700;letter-spacing:-0.2px;color:${INK};" class="brand">Proplity</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="card" style="background:${CARD};border:1px solid ${RULE};border-radius:16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="pad" style="padding:36px 40px 12px 40px;">
                  <h1 class="title" style="margin:0 0 22px 0;font-family:${FONT};font-size:26px;line-height:1.25;font-weight:700;letter-spacing:-0.4px;color:${INK};">${escapeHtml(subject)}</h1>
                  ${blocks.join('\n')}
                </td>
              </tr>
              ${noteHtml || `<tr><td style="padding:0 0 20px 0;">&nbsp;</td></tr>`}
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" class="muted" style="padding:22px 12px 0 12px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
            Proplity &middot; rent agreements, payments and repairs in one place.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
