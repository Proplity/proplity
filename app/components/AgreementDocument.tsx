'use client';

import Link from 'next/link';
import { Printer } from 'lucide-react';
import { useRent } from '@/hooks/useRents';
import { useRentAgreement } from '@/hooks/useRentAgreement';
import { useAuth } from '@/context/AuthContext';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

function Blank({ label }: { label: string }) {
  return (
    <div className="mt-6">
      <div className="h-8 border-b border-gray-400" />
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}

/**
 * The rent agreement as a document, laid out to print or save as a PDF from the browser: the
 * numbered clauses as they were when it was made, any special conditions under the landlord's own
 * heading, then the signatures with the time each was added, and a line for a witness on each side.
 */
export function AgreementDocument({ rentId }: { rentId: string }) {
  const auth = useAuth();
  const { data: rent, loading: rentLoading } = useRent(rentId);
  const { data: agreement, loading } = useRentAgreement(rentId);
  const back = auth.user?.role === 'tenant' ? '/dashboard' : `/dashboard/tenants/${rentId}`;

  if (loading || rentLoading)
    return <p className="p-8 text-sm text-gray-500">Loading agreement…</p>;
  if (!agreement || !rent) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Agreement not found</h1>
        <p className="mt-2 text-sm text-gray-600">
          Either this rent has no agreement yet, or it belongs to someone else.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-blue-600 underline">
          Back to my dashboard
        </Link>
      </div>
    );
  }

  const signatures = rent.signatures ?? [];
  const tenantSig = signatures.find((s) => s.signerRole === 'TENANT');
  const landlordSig = signatures.find((s) =>
    ['MANAGER', 'LANDLORD', 'ADMIN'].includes(s.signerRole),
  );
  const witnesses = agreement.witnesses ?? {};

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={back} className="text-sm text-gray-600 hover:text-gray-900">
          ← Back
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Printer className="h-4 w-4" />
          Print or save as PDF
        </button>
      </div>

      {agreement.source === 'UPLOADED' ? (
        <article
          aria-label="Uploaded rent agreement"
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10"
        >
          <h1 className="text-xl font-semibold">Uploaded rent agreement</h1>
          <p className="mt-2 text-sm text-gray-600">
            This agreement was uploaded as a file by the landlord or manager.
            {agreement.status === 'EXECUTED' && agreement.confirmedAt
              ? ` ${agreement.confirmedName} confirmed it on ${when(agreement.confirmedAt)}.`
              : ' It is waiting for the tenant to confirm it.'}
          </p>
          {agreement.fileUrl && (
            <a
              href={agreement.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Open the file
            </a>
          )}
        </article>
      ) : (
        <article
          aria-label="Rent agreement"
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none"
        >
          <header className="border-b border-gray-200 pb-6 text-center">
            <h1 className="text-2xl font-bold tracking-wide uppercase">Rent agreement</h1>
            <p className="mt-1 text-sm text-gray-500">
              Unit {rent.unit?.unitNumber}, {rent.unit?.property?.name}
            </p>
            {agreement.status !== 'EXECUTED' && (
              <p className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 print:hidden">
                {agreement.status === 'DRAFT' ? 'Draft: not sent yet' : 'Waiting for signatures'}
              </p>
            )}
          </header>

          <ol className="mt-6 space-y-5">
            {(agreement.clauses ?? []).map((c, i) => (
              <li key={c.id}>
                <h2 className="font-semibold">
                  {i + 1}. {c.title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-gray-800">
                  {c.body}
                </p>
              </li>
            ))}
            {agreement.specialConditions && (
              <li>
                <h2 className="font-semibold">
                  {(agreement.clauses?.length ?? 0) + 1}. Special conditions added by the Landlord
                </h2>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-gray-800">
                  {agreement.specialConditions}
                </p>
              </li>
            )}
          </ol>

          <section className="mt-10 grid break-inside-avoid gap-8 sm:grid-cols-2">
            <div>
              <h2 className="font-semibold">Landlord</h2>
              <p className="text-sm text-gray-600">
                {agreement.landlordName}
                {agreement.agentName ? `, by their agent ${agreement.agentName}` : ''}
              </p>
              {landlordSig ? (
                <p className="mt-3 text-sm">
                  <span className="font-medium italic">{landlordSig.fullNameTyped}</span>
                  <br />
                  <span className="text-xs text-gray-500">
                    Signed electronically on {when(landlordSig.signedAt)}
                  </span>
                </p>
              ) : (
                <Blank label="Signature" />
              )}
            </div>
            <div>
              <h2 className="font-semibold">Tenant</h2>
              <p className="text-sm text-gray-600">{rent.tenant?.name}</p>
              {tenantSig ? (
                <p className="mt-3 text-sm">
                  <span className="font-medium italic">{tenantSig.fullNameTyped}</span>
                  <br />
                  <span className="text-xs text-gray-500">
                    Signed electronically on {when(tenantSig.signedAt)}
                  </span>
                </p>
              ) : (
                <Blank label="Signature" />
              )}
            </div>
          </section>

          {agreement.witnessRequired && (
            <section className="mt-8 grid break-inside-avoid gap-8 sm:grid-cols-2">
              {(['landlord', 'tenant'] as const).map((side) => (
                <div key={side}>
                  <h2 className="font-semibold">
                    Witness to the {side === 'landlord' ? "Landlord's" : "Tenant's"} signature
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {witnesses[side]?.name || 'Name: ______________________'}
                    <br />
                    {witnesses[side]?.address || 'Address: ____________________'}
                  </p>
                  <Blank label="Witness signature" />
                </div>
              ))}
            </section>
          )}

          <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-500">
            Made on Proplity
            {agreement.templateKey
              ? ` from the ${agreement.templateKey} template, version ${agreement.templateVersion}`
              : ''}
            . Signed with a typed full name recorded with the time and address of signing.
            {agreement.stampDutyStatus === 'STAMPED' &&
              ` Stamped${agreement.stampedAt ? ` on ${when(agreement.stampedAt)}` : ''}${agreement.stampDutyReference ? ` (reference ${agreement.stampDutyReference})` : ''}.`}
          </footer>
        </article>
      )}
    </div>
  );
}
