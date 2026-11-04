'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import { templateCsv } from '@/lib/portfolioImport';
import type { InvitationBatchResult, PortfolioPreview, PortfolioSummary } from '@/lib/api/types';

type ApiError = {
  response?: {
    data?: {
      error?: string;
      code?: string;
      issues?: { row: number; error: string }[];
    };
  };
};

const naira = (n: number) => `₦${n.toLocaleString()}`;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function downloadTemplate() {
  const blob = new Blob([templateCsv(new Date())], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'proplity-portfolio-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function PortfolioImport() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PortfolioPreview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [problems, setProblems] = useState<{ row: number; error: string }[]>([]);
  const [confirmOverage, setConfirmOverage] = useState(false);
  const [done, setDone] = useState<PortfolioSummary | null>(null);
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState<InvitationBatchResult | null>(null);

  const check = async (chosen: File) => {
    setFile(chosen);
    setPreview(null);
    setProblem(null);
    setProblems([]);
    setConfirmOverage(false);
    setChecking(true);
    try {
      const res = await api.properties.importPortfolio(chosen, { preview: true });
      setPreview(res.data.data);
    } catch (err) {
      setProblem(
        (err as ApiError).response?.data?.error ?? 'Could not read that file. Try the template.',
      );
    } finally {
      setChecking(false);
    }
  };

  const importNow = async () => {
    if (!file) return;
    setImporting(true);
    setProblem(null);
    try {
      const res = await api.properties.importPortfolio(file, { confirmOverage });
      setDone(res.data.data.summary);
      toast.success('Imported.');
    } catch (err) {
      const data = (err as ApiError).response?.data;
      if (data?.issues) setProblems(data.issues);
      setProblem(data?.error ?? 'The import failed. Nothing was saved.');
    } finally {
      setImporting(false);
    }
  };

  const sendInvitations = async () => {
    setInviting(true);
    try {
      const res = await api.rents.inviteAll();
      setInvited(res.data.data);
    } catch (err) {
      toast.error((err as ApiError).response?.data?.error ?? 'Could not send the invitations.');
    } finally {
      setInviting(false);
    }
  };

  if (done) {
    const waiting = done.newTenantAccounts;
    return (
      <div className="max-w-3xl space-y-6">
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle2 className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Your portfolio is in Proplity</h1>
          </div>
          <p className="mt-2 text-sm text-green-900">
            {done.newProperties} new {done.newProperties === 1 ? 'property' : 'properties'}
            {done.existingProperties > 0 && `, ${done.existingProperties} existing extended`},{' '}
            {done.units} {done.units === 1 ? 'unit' : 'units'} and {done.tenancies}{' '}
            {done.tenancies === 1 ? 'tenancy' : 'tenancies'}. They are kept for management only: not
            listed, not shown to the public.
          </p>
        </div>

        {waiting > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="font-semibold text-gray-900">
              {waiting} {waiting === 1 ? 'tenant needs' : 'tenants need'} an invitation
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Their accounts are set up, but nothing has been emailed yet. An invitation lets them
              set a password and sign in; after that they complete their profile. Each invitation
              counts against your daily limit, so send as many as today allows and the rest
              tomorrow.
            </p>
            {invited ? (
              <p className="mt-4 text-sm text-gray-900" role="status">
                Sent {invited.sent}.{' '}
                {invited.stillWaiting > 0
                  ? `${invited.stillWaiting} still waiting${invited.limitReached ? ` (today’s limit is ${invited.dailyLimit})` : ''}. Come back tomorrow and press the button again.`
                  : 'Everyone has been invited.'}
              </p>
            ) : (
              <button
                type="button"
                onClick={sendInvitations}
                disabled={inviting}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {inviting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send invitations
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/dashboard/properties" className="font-medium text-blue-600 hover:underline">
            See my properties
          </Link>
          <Link href="/dashboard/tenants" className="font-medium text-blue-600 hover:underline">
            See my tenants
          </Link>
        </div>
      </div>
    );
  }

  const blocked = !!preview?.capacity?.blocking;
  const needsConfirm = preview?.capacity?.code === 'OVERAGE_NEEDS_CONFIRMATION';

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Import your properties from a file
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Already manage buildings and tenants? Upload a spreadsheet with one row per unit and the
          tenant in it. They are added for management only: nothing is listed publicly or sent to an
          admin for review. The units count towards your plan.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <ol className="list-inside list-decimal space-y-1 text-sm text-gray-700">
          <li>
            Download the template and fill it in (property name, address, city and unit number are
            needed on every row; leave the tenant columns empty for a vacant unit).
          </li>
          <li>
            For a tenancy that has already started, give <strong>nextRentDue</strong>: the date the
            next rent falls due, or <strong>PAID</strong> if the whole term is paid. Without it the
            tenant would be billed again for rent they already paid.
          </li>
          <li>Upload the file. You see everything it will do before anything is saved.</li>
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Download template
          </button>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {file ? 'Choose another file' : 'Choose a file'}
          </button>
          <input
            ref={input}
            type="file"
            accept=".csv,.xlsx"
            className="sr-only"
            aria-label="Spreadsheet of properties, units and tenants"
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              if (chosen) void check(chosen);
              e.target.value = '';
            }}
          />
          {file && <span className="text-sm text-gray-600">{file.name}</span>}
        </div>
      </div>

      {checking && (
        <p className="flex items-center gap-2 text-sm text-gray-600" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking the file…
        </p>
      )}

      {problem && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          <p className="font-medium">{problem}</p>
          {problems.length > 0 && (
            <ul className="mt-2 list-inside list-disc">
              {problems.map((i) => (
                <li key={`${i.row}-${i.error}`}>
                  Row {i.row}: {i.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {preview && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Properties" value={preview.summary.properties} />
            <Stat label="Units" value={preview.summary.units} />
            <Stat label="Tenancies" value={preview.summary.tenancies} />
            <Stat label="New tenant accounts" value={preview.summary.newTenantAccounts} />
          </div>

          {preview.issues.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
              <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
                <AlertTriangle className="h-4 w-4" />
                Fix these in the file and upload it again. Nothing is saved until the file has no
                problems.
              </p>
              <ul className="mt-2 max-h-64 list-inside list-disc overflow-y-auto text-sm text-red-800">
                {preview.issues.map((i) => (
                  <li key={`${i.row}-${i.error}`}>
                    {i.row > 0 ? `Row ${i.row}: ` : ''}
                    {i.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.capacity && (
            <div
              className={`rounded-lg border p-4 text-sm ${
                preview.capacity.blocking
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
              role="alert"
            >
              <p>{preview.capacity.message}</p>
              {blocked && (
                <Link href="/pricing" className="mt-1 inline-block font-medium underline">
                  See plans
                </Link>
              )}
              {needsConfirm && (
                <label className="mt-2 flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={confirmOverage}
                    onChange={(e) => setConfirmOverage(e.target.checked)}
                  />
                  I accept the extra monthly cost
                </label>
              )}
            </div>
          )}

          {preview.summary.newTenantAccounts > 0 && (
            <p className="text-sm text-gray-600">
              {preview.summary.newTenantAccounts} new tenant{' '}
              {preview.summary.newTenantAccounts === 1 ? 'account' : 'accounts'} will be set up
              without an email. You can invite them after the import
              {preview.invitations.remainingToday !== null &&
                `; you can send ${preview.invitations.remainingToday} of your ${preview.invitations.dailyLimit} invitations today`}
              .
            </p>
          )}

          <div className="space-y-4">
            {preview.properties.map((p) => (
              <div
                key={`${p.name}|${p.address}|${p.city}`}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-4 py-3">
                  <div>
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      {p.address}, {p.city}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {p.existing ? 'Adding units to an existing property' : 'New, management only'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-gray-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">Row</th>
                        <th className="px-4 py-2 font-medium">Unit</th>
                        <th className="px-4 py-2 font-medium">Rent</th>
                        <th className="px-4 py-2 font-medium">Tenant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.units.map((u) => (
                        <tr key={u.row} className="border-t border-gray-100">
                          <td className="px-4 py-2 text-gray-500 tabular-nums">{u.row}</td>
                          <td className="px-4 py-2 font-medium text-gray-900">{u.unitNumber}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-gray-700 tabular-nums">
                            {naira(u.rentAmount)}
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {u.tenant ? (
                              <>
                                {u.tenant.name}{' '}
                                <span className="text-xs text-gray-500">
                                  {u.tenant.email} ·{' '}
                                  {u.tenant.account === 'NEW' ? 'new account' : 'has an account'} ·{' '}
                                  {u.tenant.status === 'ACTIVE'
                                    ? 'already running'
                                    : 'starts later'}
                                </span>
                              </>
                            ) : (
                              <span className="text-gray-400">Vacant</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={importNow}
              disabled={importing || !preview.canImport || (needsConfirm && !confirmOverage)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              Import {preview.summary.units} {preview.summary.units === 1 ? 'unit' : 'units'}
            </button>
            {!preview.canImport && preview.issues.length === 0 && !blocked && (
              <span className="text-sm text-gray-600">There is nothing in the file to import.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
