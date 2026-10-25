'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import { Switch } from '@/app/components/ui/switch';
import { AGREEMENT_FIELDS, CLAUSE_MODES, clauseProblems } from '@/lib/agreementFields';
import type { AgreementTemplate, Jurisdiction, TemplateClauseData } from '@/lib/api/types';
import { Field, inputClass, message } from './ui';

const MODE_LABEL: Record<TemplateClauseData['mode'], string> = {
  LOCKED: 'Locked (same in every agreement)',
  EDITABLE: 'Editable (the manager may reword it)',
  OPTIONAL: 'Optional (the manager may leave it out)',
};

const STATUS_STYLE: Record<AgreementTemplate['status'], string> = {
  DRAFT: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-gray-100 text-gray-600',
};

const slugOf = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

function FieldHelp() {
  return (
    <details className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600">
      <summary className="cursor-pointer font-medium text-gray-800">
        Fields a clause can use
      </summary>
      <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {Object.entries(AGREEMENT_FIELDS).map(([key, what]) => (
          <div key={key}>
            <dt className="inline font-mono text-gray-900">{`{{${key}}}`}</dt>{' '}
            <dd className="inline">{what}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function Editor({
  template,
  jurisdictions,
  onDone,
  onCancel,
}: {
  /** Absent for a brand-new template. */
  template?: AgreementTemplate;
  jurisdictions: Jurisdiction[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(template?.name ?? '');
  const [key, setKey] = useState(template?.key ?? '');
  const [jurisdictionId, setJurisdictionId] = useState(
    template?.jurisdictionId ?? jurisdictions[0]?.id ?? '',
  );
  const [witnessRequired, setWitnessRequired] = useState(template?.witnessRequired ?? true);
  const [notes, setNotes] = useState(template?.notes ?? '');
  const [clauses, setClauses] = useState<TemplateClauseData[]>(
    template?.clauses ?? [{ id: 'parties', title: 'The parties', body: '', mode: 'LOCKED' }],
  );
  const [saving, setSaving] = useState(false);

  const problems = useMemo(() => clauseProblems(clauses), [clauses]);
  const readOnly = !!template && template.status !== 'DRAFT';

  const change = (i: number, patch: Partial<TemplateClauseData>) =>
    setClauses((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const move = (i: number, by: -1 | 1) =>
    setClauses((cs) => {
      const j = i + by;
      if (j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const add = () =>
    setClauses((cs) => {
      let n = cs.length + 1;
      while (cs.some((c) => c.id === `clause-${n}`)) n += 1;
      return [...cs, { id: `clause-${n}`, title: '', body: '', mode: 'EDITABLE' }];
    });

  const save = async () => {
    setSaving(true);
    try {
      const cleaned = clauses.map((c) => ({
        ...c,
        id: c.id.trim() || slugOf(c.title) || 'clause',
        ...(c.mode === 'OPTIONAL' ? { defaultOn: c.defaultOn ?? true } : { defaultOn: undefined }),
      }));
      if (template) {
        await api.admin.agreementTemplates.update(template.id, {
          name: name.trim(),
          clauses: cleaned,
          witnessRequired,
          notes: notes.trim() || null,
        });
      } else {
        await api.admin.agreementTemplates.create({
          key: key.trim() || slugOf(name),
          name: name.trim(),
          jurisdictionId,
          clauses: cleaned,
          witnessRequired,
          notes: notes.trim() || null,
        });
      }
      toast.success('Template saved as a draft.');
      onDone();
    } catch (err) {
      toast.error(message(err, 'Could not save the template.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 rounded-lg border border-blue-200 bg-blue-50/30 p-5">
      {readOnly && (
        <p className="rounded-lg bg-white p-3 text-sm text-gray-700">
          This version is {template.status.toLowerCase()} and cannot be edited. Use{' '}
          <strong>New version</strong> to change the wording.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            className={inputClass}
            value={name}
            disabled={readOnly}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {!template && (
          <Field label="Jurisdiction">
            <select
              className={inputClass}
              value={jurisdictionId}
              onChange={(e) => setJurisdictionId(e.target.value)}
            >
              {jurisdictions.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!template && (
          <Field
            label="Key"
            hint="Groups the versions of one wording. Lower-case, numbers and dashes."
          >
            <input
              className={inputClass}
              value={key}
              placeholder={slugOf(name)}
              onChange={(e) => setKey(e.target.value)}
            />
          </Field>
        )}
        <label className="flex items-center gap-2 self-end text-sm text-gray-800">
          <Switch
            checked={witnessRequired}
            disabled={readOnly}
            onCheckedChange={setWitnessRequired}
            aria-label="Lines for a witness on each side"
          />
          Lines for a witness on each side
        </label>
      </div>
      <Field label="Notes for the team (not shown in agreements)">
        <textarea
          rows={2}
          className={inputClass}
          value={notes}
          disabled={readOnly}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>

      <FieldHelp />

      <ol className="space-y-3">
        {clauses.map((c, i) => (
          <li key={i} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_16rem]">
              <Field label={`Clause ${i + 1} title`}>
                <input
                  className={inputClass}
                  value={c.title}
                  disabled={readOnly}
                  onChange={(e) => change(i, { title: e.target.value })}
                />
              </Field>
              <Field label="Who may change it">
                <select
                  className={inputClass}
                  value={c.mode}
                  disabled={readOnly}
                  onChange={(e) =>
                    change(i, { mode: e.target.value as TemplateClauseData['mode'] })
                  }
                >
                  {CLAUSE_MODES.map((m) => (
                    <option key={m} value={m}>
                      {MODE_LABEL[m]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Wording">
                <textarea
                  rows={4}
                  className={inputClass}
                  value={c.body}
                  disabled={readOnly}
                  onChange={(e) => change(i, { body: e.target.value })}
                />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                {c.mode === 'OPTIONAL' && (
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={c.defaultOn ?? true}
                      disabled={readOnly}
                      onChange={(e) => change(i, { defaultOn: e.target.checked })}
                    />
                    Included until the manager turns it off
                  </label>
                )}
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  id
                  <input
                    className="w-40 rounded border border-gray-200 px-2 py-1 font-mono text-xs"
                    value={c.id}
                    disabled={readOnly}
                    onChange={(e) => change(i, { id: e.target.value })}
                  />
                </label>
              </div>
              {!readOnly && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move clause ${i + 1} up`}
                    className="rounded border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === clauses.length - 1}
                    aria-label={`Move clause ${i + 1} down`}
                    className="rounded border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setClauses((cs) => cs.filter((_, idx) => idx !== i))}
                    aria-label={`Remove clause ${i + 1}`}
                    className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {!readOnly && (
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" />
          Add a clause
        </button>
      )}

      {problems.length > 0 && !readOnly && (
        <ul className="list-inside list-disc text-sm text-red-700" role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-3">
        {!readOnly && (
          <button
            type="button"
            onClick={save}
            disabled={saving || !name.trim() || problems.length > 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save draft'}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {readOnly ? 'Close' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

export function TemplatesPanel() {
  const [templates, setTemplates] = useState<AgreementTemplate[] | null>(null);
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([]);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, j] = await Promise.all([
        api.admin.agreementTemplates.list(),
        api.admin.jurisdictions.list(),
      ]);
      setTemplates(t.data.data);
      setJurisdictions(j.data.data);
    } catch {
      toast.error('Failed to load the templates.');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const run = async (id: string, action: () => Promise<unknown>, done: string) => {
    setBusy(id);
    try {
      await action();
      toast.success(done);
      await load();
    } catch (err) {
      toast.error(message(err, 'That did not work. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  const grouped = useMemo(() => {
    const byKey = new Map<string, AgreementTemplate[]>();
    for (const t of templates ?? []) byKey.set(t.key, [...(byKey.get(t.key) ?? []), t]);
    return [...byKey.values()];
  }, [templates]);

  if (!templates) return <Loader2 className="h-5 w-5 animate-spin text-gray-400" />;

  const button =
    'rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-gray-600">
        The wording of each agreement, by place. Edit a draft freely; once a version is approved it
        never changes, and a change is a new version. Agreements already made keep the text they
        were made from.
      </p>

      {grouped.map((versions) => (
        <div key={versions[0].key} className="rounded-lg border border-gray-200 p-4">
          <p className="font-medium text-gray-900">{versions[0].name}</p>
          <p className="text-xs text-gray-500">
            {versions[0].jurisdiction?.name} · key {versions[0].key}
          </p>
          <ul className="mt-3 divide-y divide-gray-100">
            {versions.map((t) => (
              <li key={t.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-medium text-gray-900">Version {t.version}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[t.status]}`}
                    >
                      {t.status === 'DRAFT'
                        ? 'Draft'
                        : t.status === 'APPROVED'
                          ? 'Approved'
                          : 'Archived'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {t.clauses.length} clauses
                      {t.approvedAt &&
                        ` · approved ${new Date(t.approvedAt).toLocaleDateString('en-GB')}`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={button} onClick={() => setEditing(t.id)}>
                      {t.status === 'DRAFT' ? 'Edit' : 'View'}
                    </button>
                    {t.status === 'DRAFT' && (
                      <button
                        type="button"
                        className={`${button} border-green-300 text-green-700 hover:bg-green-50`}
                        disabled={busy === t.id}
                        onClick={() =>
                          run(t.id, () => api.admin.agreementTemplates.approve(t.id), 'Approved.')
                        }
                      >
                        Approve
                      </button>
                    )}
                    {t.status !== 'DRAFT' && (
                      <button
                        type="button"
                        className={button}
                        disabled={busy === t.id}
                        onClick={() =>
                          run(
                            t.id,
                            () => api.admin.agreementTemplates.newVersion(t.id),
                            'A new draft version was made.',
                          )
                        }
                      >
                        New version
                      </button>
                    )}
                    {t.status !== 'ARCHIVED' && (
                      <button
                        type="button"
                        className={button}
                        disabled={busy === t.id}
                        onClick={() =>
                          run(t.id, () => api.admin.agreementTemplates.archive(t.id), 'Archived.')
                        }
                      >
                        Archive
                      </button>
                    )}
                    {t.status === 'DRAFT' && (
                      <button
                        type="button"
                        aria-label={`Delete version ${t.version} of ${t.name}`}
                        className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        disabled={busy === t.id}
                        onClick={() => {
                          if (!window.confirm('Delete this draft? This cannot be undone.')) return;
                          void run(
                            t.id,
                            () => api.admin.agreementTemplates.remove(t.id),
                            'Deleted.',
                          );
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                {t.notes && <p className="mt-1 text-xs text-gray-500">{t.notes}</p>}
                {editing === t.id && (
                  <div className="mt-3">
                    <Editor
                      template={t}
                      jurisdictions={jurisdictions}
                      onCancel={() => setEditing(null)}
                      onDone={() => {
                        setEditing(null);
                        void load();
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {editing === 'new' ? (
        <Editor
          jurisdictions={jurisdictions}
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          disabled={jurisdictions.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" />
          Add a template
        </button>
      )}
    </div>
  );
}
