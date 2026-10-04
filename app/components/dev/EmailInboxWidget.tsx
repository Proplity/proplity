'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Mail, X, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

type SentEmailRecord = {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
};

const POLL_INTERVAL_MS = 4000;
// Matches lib/email.ts's own linkification-free body, so a verification/
// reset/invite link can be opened straight from the panel instead of
// copy-pasting the raw email text.
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        URL_PATTERN.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-blue-600 underline hover:text-blue-800"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function EmailRow({ email }: { email: SentEmailRecord }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{email.subject}</p>
          <p className="truncate text-xs text-gray-500">To: {email.to}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-gray-400">
          {formatDistanceToNowStrict(new Date(email.sentAt), { addSuffix: true })}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      {expanded && (
        <div className="bg-gray-50 px-4 py-3 text-sm whitespace-pre-wrap text-gray-700">
          <Linkified text={email.body} />
        </div>
      )}
    </div>
  );
}

// Local/staging-only testing tool, off unless NEXT_PUBLIC_EMAIL_INBOX_ENABLED
// is set -- see lib/email.ts. Shows every email the app has "sent" through
// console-transport (or real Resend, if configured) since the server
// started, newest first, so a tester can grab a verification/reset/invite
// link without needing real email delivery.
export function EmailInboxWidget() {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<SentEmailRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/dev/emails');
      if (res.ok) {
        const body = await res.json();
        setEmails(body.data);
      }
    } catch {
      // best-effort -- a failed poll just keeps showing the last-known list
    } finally {
      setLoading(false);
    }
  };

  // Polls whether or not the panel is open -- otherwise the badge count on
  // the closed button would only ever update the moment you open it.
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClear = async () => {
    await fetch('/api/v1/dev/emails', { method: 'DELETE' });
    setEmails([]);
  };

  return (
    <div className="fixed bottom-24 left-6 z-50 lg:bottom-6">
      {open && (
        <div className="mb-3 flex h-[28rem] w-[22rem] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="text-sm font-semibold">Sent Emails (testing)</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={refresh}
                aria-label="Refresh"
                className="rounded p-1 hover:bg-white/10"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleClear}
                aria-label="Clear all"
                className="rounded p-1 hover:bg-white/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-1 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {emails.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">
                No emails sent yet this session.
              </p>
            ) : (
              emails.map((email) => <EmailRow key={email.id} email={email} />)
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close sent emails panel' : 'Open sent emails panel'}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gray-900 text-white shadow-xl transition-transform hover:scale-105"
      >
        <Mail className="h-5 w-5" />
        {!open && emails.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold">
            {emails.length}
          </span>
        )}
      </button>
    </div>
  );
}
