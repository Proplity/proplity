'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useProperty } from '@/hooks/useProperties';
import { api } from '@/lib/apiClient';
import { useApiSubmit } from '@/hooks/useApiSubmit';

// ISS-016: the screen that writes a neighbourhood report. Each section is a
// free-form object on the server; this form edits the four fields the report
// page reads (rating, status, features, notes) and keeps any other keys the
// section already had, so correcting one field never drops the rest.
const SECTIONS = [
  { key: 'security', label: 'Security' },
  { key: 'electricity', label: 'Electricity' },
  { key: 'water', label: 'Water' },
  { key: 'roadNetwork', label: 'Road network' },
  { key: 'flooding', label: 'Flooding' },
  { key: 'amenities', label: 'Amenities' },
  { key: 'demographics', label: 'Demographics' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];
type Draft = { rating: string; status: string; features: string; notes: string };
type Original = Record<string, unknown>;

function toDraft(section: Original | null | undefined): Draft {
  return {
    rating: typeof section?.rating === 'number' ? String(section.rating) : '',
    status: typeof section?.status === 'string' ? section.status : '',
    features: Array.isArray(section?.features)
      ? section.features.filter((f): f is string => typeof f === 'string').join('\n')
      : '',
    notes: typeof section?.notes === 'string' ? section.notes : '',
  };
}

// Builds the section to save: the original object with the four edited
// fields applied. Empty fields are removed rather than stored as blanks.
export function fromDraft(draft: Draft, original: Original | null | undefined): Original {
  const out: Original = { ...(original ?? {}) };
  const rating = draft.rating.trim();
  if (rating === '') delete out.rating;
  else out.rating = Number(rating);
  if (draft.status.trim()) out.status = draft.status.trim();
  else delete out.status;
  const features = draft.features
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
  if (features.length > 0) out.features = features;
  else delete out.features;
  if (draft.notes.trim()) out.notes = draft.notes.trim();
  else delete out.notes;
  return out;
}

export function NeighbourhoodReportEditor({ propertyId }: { propertyId: string }) {
  const { data: property, loading, error } = useProperty(propertyId);
  const report = property?.neighbourhoodReports[0] ?? null;
  const [drafts, setDrafts] = useState<Record<SectionKey, Draft> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    submit: submitReport,
    submitting: saving,
    error: serverError,
  } = useApiSubmit((body: Record<string, Original>) =>
    api.properties.saveNeighbourhoodReport(propertyId, body),
  );
  const saveError = formError ?? serverError;
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!property) return;
    const timer = setTimeout(() => {
      setDrafts(
        Object.fromEntries(SECTIONS.map((s) => [s.key, toDraft(report?.[s.key])])) as Record<
          SectionKey,
          Draft
        >,
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [property, report]);

  const update = (key: SectionKey, field: keyof Draft, value: string) => {
    setSaved(false);
    setDrafts((d) => (d ? { ...d, [key]: { ...d[key], [field]: value } } : d));
  };

  const save = async () => {
    if (!drafts) return;
    // Send only the sections that differ from what is saved, so the audit
    // log records what was actually changed.
    const body: Record<string, Original> = {};
    for (const { key } of SECTIONS) {
      const original = report?.[key] ?? null;
      const next = fromDraft(drafts[key], original);
      if (JSON.stringify(next) !== JSON.stringify(original ?? {})) body[key] = next;
    }
    if (Object.keys(body).length === 0) {
      setFormError('Nothing has changed.');
      return;
    }
    const outOfRange = Object.values(body).some(
      (s) =>
        typeof s.rating === 'number' && (s.rating < 0 || s.rating > 10 || Number.isNaN(s.rating)),
    );
    if (outOfRange) {
      setFormError('Ratings must be between 0 and 10.');
      return;
    }
    setFormError(null);
    try {
      await submitReport(body);
      setSaved(true);
    } catch {
      // the message is in serverError
    }
  };

  if (loading) return <div className="p-6 text-gray-500">Loading…</div>;
  if (error || !property || !drafts) {
    return <div className="p-6 text-red-600">{error ?? 'Property not found.'}</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/properties/${propertyId}`}
          className="rounded-lg p-2 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Neighbourhood report</h1>
          <p className="text-sm text-gray-500">
            {property.name}
            {report
              ? ` · last saved ${new Date(report.generatedAt).toLocaleDateString('en-GB')}`
              : ' · no report yet'}
          </p>
        </div>
      </div>

      <p className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Tenants and applicants see this report. Fill in only what you know; empty fields are left
        out. Each save keeps the earlier version.
      </p>

      {SECTIONS.map(({ key, label }) => (
        <section key={key} className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="font-semibold">{label}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">Rating (0–10)</span>
              <input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={drafts[key].rating}
                onChange={(e) => update(key, 'rating', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-gray-600">Status</span>
              <input
                type="text"
                value={drafts[key].status}
                onChange={(e) => update(key, 'status', e.target.value)}
                placeholder="e.g. Reliable, Moderate risk"
                className="w-full rounded-lg border border-gray-200 px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Features (one per line)</span>
            <textarea
              rows={3}
              value={drafts[key].features}
              onChange={(e) => update(key, 'features', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Notes</span>
            <textarea
              rows={2}
              value={drafts[key].notes}
              onChange={(e) => update(key, 'notes', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2"
            />
          </label>
        </section>
      ))}

      {saveError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {saveError}
        </p>
      )}
      {saved && (
        <p className="flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" /> Report saved.
        </p>
      )}
      <button
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save report'}
      </button>
    </div>
  );
}
