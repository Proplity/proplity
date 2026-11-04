'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/apiClient';
import type { WitnessAgreement } from '@/lib/api/types';

const sideWord = { LANDLORD: "the Landlord's", TENANT: "the Tenant's" } as const;

type Problem = { code: string; message: string };

const problemOf = (err: unknown): Problem => {
  const res = (err as { response?: { status?: number; data?: { error?: string; code?: string } } })
    .response;
  return {
    code: res?.data?.code ?? (res?.status === 404 ? 'NOT_FOUND' : 'ERROR'),
    message: res?.data?.error ?? 'Something went wrong. Please try again.',
  };
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">{children}</div>
    </main>
  );
}

// The page a witness reaches from the emailed link. No account and no app chrome: they read the
// agreement and add their name once. The token in the address is the only credential.
export default function Page() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<WitnessAgreement | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData((await api.witness.get(token)).data.data);
      setProblem(null);
    } catch (err) {
      setProblem(problemOf(err));
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const sign = async () => {
    setBusy(true);
    try {
      await api.witness.sign(token, fullName.trim());
      await load();
    } catch (err) {
      setProblem(problemOf(err));
    } finally {
      setBusy(false);
    }
  };

  if (problem && !data) {
    return (
      <Shell>
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold">This link can&apos;t be used</h1>
          <p className="mt-2 text-sm text-gray-600" role="alert">
            {problem.message}
          </p>
        </div>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell>
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" aria-label="Loading" />
      </Shell>
    );
  }

  if (data.state === 'SIGNED') {
    return (
      <Shell>
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <CheckCircle className="mx-auto h-10 w-10 text-green-600" aria-hidden="true" />
          <h1 className="mt-3 text-xl font-semibold">Thank you, {data.witnessName}</h1>
          <p className="mt-2 text-sm text-gray-600">
            You signed as {sideWord[data.side]} witness to the rent agreement for unit {data.unit}{' '}
            at {data.property}
            {data.signedAt
              ? ` on ${new Date(data.signedAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}`
              : ''}
            . You don&apos;t need to do anything else.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <article
        aria-label="Rent agreement to witness"
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10"
      >
        <header className="border-b border-gray-200 pb-5 text-center">
          <h1 className="text-xl font-bold tracking-wide uppercase">Rent agreement</h1>
          <p className="mt-1 text-sm text-gray-500">
            Unit {data.unit}, {data.property}
            {data.address ? `, ${data.address}` : ''}
          </p>
          <p className="mt-2 text-sm text-gray-700">
            Landlord: {data.landlordName}
            {data.agentName ? ` (by their agent ${data.agentName})` : ''}. Tenant: {data.tenantName}
            .
          </p>
        </header>
        <ol className="mt-6 space-y-5">
          {(data.clauses ?? []).map((c, i) => (
            <li key={c.id}>
              <h2 className="font-semibold">
                {i + 1}. {c.title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-gray-800">
                {c.body}
              </p>
            </li>
          ))}
          {data.specialConditions && (
            <li>
              <h2 className="font-semibold">
                {(data.clauses?.length ?? 0) + 1}. Special conditions added by the Landlord
              </h2>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-gray-800">
                {data.specialConditions}
              </p>
            </li>
          )}
        </ol>

        <section className="mt-8 space-y-3 border-t border-gray-200 pt-6">
          <h2 className="font-semibold">Sign as witness to {sideWord[data.side]} signature</h2>
          <p className="text-sm text-gray-600">
            By typing your full name you confirm that you saw {sideWord[data.side]} signature and
            that you have read this agreement. Your name is recorded with the time and the address
            you are using.
          </p>
          <label className="block text-sm text-gray-700" htmlFor="witness-name">
            Your full name
          </label>
          <input
            id="witness-name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={data.witnessName}
            autoComplete="name"
          />
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            I saw {sideWord[data.side]} signature and I am signing as a witness.
          </label>
          {problem && (
            <p className="text-sm text-red-600" role="alert">
              {problem.message}
            </p>
          )}
          <button
            type="button"
            onClick={sign}
            disabled={busy || !agreed || !fullName.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Signing…' : 'Sign as witness'}
          </button>
        </section>
      </article>
    </Shell>
  );
}
