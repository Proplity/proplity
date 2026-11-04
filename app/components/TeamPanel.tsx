'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import { useMyProperties } from '@/hooks/useProperties';
import type { TeamOverview } from '@/lib/api/types';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';

function apiMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;
}

function CreateCompany({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    try {
      await api.team.create(name);
      toast.success('Company created. Now add the people in your firm.');
      onCreated();
    } catch (err) {
      toast.error(apiMessage(err, 'Could not create the company.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900">Run your firm on Proplity</h2>
      <p className="mt-1 text-sm text-gray-600">
        Give the people in your company their own logins. You stay the managing partner: you see
        every property your team manages, hand properties to the right person, and one plan covers
        everyone.
      </p>
      <label className="mt-4 block text-sm font-medium text-gray-700" htmlFor="company-name">
        Company name
      </label>
      <input
        id="company-name"
        className={`${inputClass} mt-1`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Diya Fatimilehin & Co"
      />
      <button
        type="button"
        onClick={create}
        disabled={saving || !name.trim()}
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Creating…' : 'Create company'}
      </button>
    </div>
  );
}

function AddPerson({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const add = async () => {
    setSaving(true);
    setProblem(null);
    try {
      await api.team.addMember({ name, email });
      toast.success(`${name} has been sent an email to set their password.`);
      setName('');
      setEmail('');
      onAdded();
    } catch (err) {
      setProblem(apiMessage(err, 'Could not add this person.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="flex items-center gap-2 font-medium text-gray-900">
        <UserPlus className="h-4 w-4" />
        Add a person
      </h3>
      <p className="mt-1 text-xs text-gray-600">
        They get their own manager account and an email to set a password. Someone who already has a
        Proplity account cannot be added.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block text-xs font-medium text-gray-700">
          Name
          <input
            className={`${inputClass} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Email address
          <input
            type="email"
            className={`${inputClass} mt-1`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={add}
          disabled={saving || !name.trim() || !email.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add'}
        </button>
      </div>
      {problem && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {problem}{' '}
          {problem.includes('plan') && (
            <Link href="/pricing" className="font-medium underline">
              See plans
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

function WhoManagesWhat({ team, onChanged }: { team: TeamOverview; onChanged: () => void }) {
  const { data: properties, refetch } = useMyProperties();
  const [saving, setSaving] = useState<string | null>(null);

  const assign = async (propertyId: string, managerId: string) => {
    setSaving(propertyId);
    try {
      await api.properties.update(propertyId, { managerId });
      toast.success('Property reassigned.');
      await refetch();
      onChanged();
    } catch (err) {
      toast.error(apiMessage(err, 'Could not reassign this property.'));
    } finally {
      setSaving(null);
    }
  };

  if (properties.length === 0) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="font-medium text-gray-900">Who manages what</h3>
      <p className="mt-1 text-xs text-gray-600">
        Hand a property to someone on your team. Its tenants, invoices and messages follow them.
      </p>
      <div className="mt-3 divide-y divide-gray-100">
        {properties.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div>
              <p className="text-sm font-medium text-gray-900">{p.name}</p>
              <p className="text-xs text-gray-500">{p.address}</p>
            </div>
            <select
              aria-label={`Manager of ${p.name}`}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              value={p.managerId ?? ''}
              disabled={saving === p.id}
              onChange={(e) => assign(p.id, e.target.value)}
            >
              {!p.managerId && <option value="">No manager</option>}
              {team.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.isPartner ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamPanel() {
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.team.get();
      setTeam(res.data.data);
    } catch {
      toast.error('Failed to load your team.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const remove = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Remove ${name} from the company? Their properties go back to you and they keep an empty account.`,
      )
    ) {
      return;
    }
    try {
      const res = await api.team.removeMember(id);
      toast.success(
        res.data.data.propertiesReassigned > 0
          ? `${name} removed. ${res.data.data.propertiesReassigned} propert${res.data.data.propertiesReassigned === 1 ? 'y' : 'ies'} came back to you.`
          : `${name} removed.`,
      );
      await load();
    } catch (err) {
      toast.error(apiMessage(err, 'Could not remove this person.'));
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-label="Loading" />
      </div>
    );
  }
  if (!team) return null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <UsersRound className="h-6 w-6" />
          {team.organisation ? team.organisation.name : 'Team'}
        </h1>
        <p className="mt-1 text-gray-600">
          {team.organisation
            ? team.isPartner
              ? 'The people in your company, and who manages which property.'
              : 'The people in your company. Your managing partner looks after the plan and who manages what.'
            : 'Add the people in your firm to your account.'}
        </p>
      </div>

      {!team.organisation ? (
        <CreateCompany onCreated={load} />
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-900">Users on your plan</span>
              <span className="text-gray-700 tabular-nums">
                {team.seats.used} of {team.seats.included}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${team.seats.used >= team.seats.included ? 'bg-amber-500' : 'bg-blue-500'}`}
                style={{
                  width: `${Math.min(100, Math.round((team.seats.used / Math.max(1, team.seats.included)) * 100))}%`,
                }}
              />
            </div>
            <div className="mt-4 divide-y divide-gray-100">
              {team.members.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {m.name}
                      {m.isPartner && (
                        <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Managing partner
                        </span>
                      )}
                      {m.status === 'PENDING_VERIFICATION' && (
                        <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Waiting to set a password
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {m.email} · {m.properties} propert{m.properties === 1 ? 'y' : 'ies'}
                    </p>
                  </div>
                  {team.isPartner && !m.isPartner && (
                    <button
                      type="button"
                      onClick={() => remove(m.id, m.name)}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {team.isPartner && <AddPerson onAdded={load} />}
          {team.isPartner && team.members.length > 1 && (
            <WhoManagesWhat team={team} onChanged={load} />
          )}
        </>
      )}
    </div>
  );
}
