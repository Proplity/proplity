'use client';

import { useState } from 'react';
import { CalendarClock, Pause, Pencil, Play, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useEquipment } from '@/hooks/useEquipment';
import { useMaintenanceCategories } from '@/hooks/useMaintenanceRequests';
import {
  useCreateSchedule,
  useDeleteSchedule,
  useMaintenanceSchedules,
  useUpdateSchedule,
} from '@/hooks/useMaintenanceSchedules';
import { useMyProperties } from '@/hooks/useProperties';
import type { MaintenanceSchedule, ScheduleFrequency } from '@/lib/api/types';
import { ConfirmDialog } from './ConfirmDialog';

const FREQUENCIES: { value: ScheduleFrequency; label: string }[] = [
  { value: 'WEEKLY', label: 'Every week' },
  { value: 'MONTHLY', label: 'Every month' },
  { value: 'QUARTERLY', label: 'Every 3 months' },
  { value: 'SEMI_ANNUAL', label: 'Every 6 months' },
  { value: 'ANNUAL', label: 'Every year' },
];
const frequencyLabel = (f: ScheduleFrequency) => FREQUENCIES.find((x) => x.value === f)?.label ?? f;

// Dates are stored as calendar days (UTC), so show them as the same day everywhere.
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
const isoDay = (iso: string) => iso.slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

const field =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';

function ScheduleForm({
  schedule,
  onClose,
  onDone,
}: {
  /** Editing this schedule, or creating a new one when absent. */
  schedule?: MaintenanceSchedule;
  onClose: () => void;
  onDone: () => void;
}) {
  const editing = !!schedule;
  const { data: properties } = useMyProperties();
  const { data: categories } = useMaintenanceCategories();
  const create = useCreateSchedule();
  const update = useUpdateSchedule();
  const submitting = create.submitting || update.submitting;
  const error = create.error ?? update.error;

  const [propertyId, setPropertyId] = useState(schedule?.unit?.property?.id ?? '');
  const [unitId, setUnitId] = useState(schedule?.unitId ?? '');
  const [categoryId, setCategoryId] = useState(schedule?.categoryId ?? '');
  const [frequency, setFrequency] = useState<ScheduleFrequency>(schedule?.frequency ?? 'MONTHLY');
  const [nextDue, setNextDue] = useState(schedule ? isoDay(schedule.nextDueDate) : '');
  const [equipmentId, setEquipmentId] = useState(schedule?.equipmentId ?? '');

  const units = properties.find((p) => p.id === propertyId)?.units ?? [];
  const selectedUnit = units.find((u) => u.id === unitId) ?? schedule?.unit;
  const { data: equipment } = useEquipment(propertyId || null);
  const equipmentHere = equipment.filter((e) => e.unitId === unitId || e.propertyId === propertyId);
  const vacant = selectedUnit?.status === 'VACANT';
  const valid = !!unitId && !!categoryId && !!nextDue;

  const save = async () => {
    if (!valid) return;
    try {
      if (schedule) {
        await update.submit(schedule.id, {
          categoryId,
          frequency,
          nextDueDate: nextDue,
          equipmentId: equipmentId || null,
        });
        toast.success('Schedule updated.');
      } else {
        await create.submit({
          unitId,
          categoryId,
          frequency,
          nextDueDate: nextDue,
          ...(equipmentId ? { equipmentId } : {}),
        });
        toast.success('Schedule created.');
      }
      onDone();
    } catch {
      // surfaced through `error`
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit schedule' : 'New schedule'}
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-5">
          <div>
            <h2 className="text-lg font-semibold">{editing ? 'Edit schedule' : 'New schedule'}</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              A repair is raised automatically each time it falls due, and the property team is
              asked to find a vendor.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-5">
          {editing ? (
            <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              {schedule.unit?.property?.name}, unit {schedule.unit?.unitNumber}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Property</span>
                <select
                  value={propertyId}
                  onChange={(e) => {
                    setPropertyId(e.target.value);
                    setUnitId('');
                    setEquipmentId('');
                  }}
                  className={field}
                >
                  <option value="">Choose a property</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Unit</span>
                <select
                  value={unitId}
                  onChange={(e) => {
                    setUnitId(e.target.value);
                    setEquipmentId('');
                  }}
                  disabled={!propertyId}
                  className={field}
                >
                  <option value="">{propertyId ? 'Choose a unit' : 'Pick a property first'}</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unitNumber} ({u.status.toLowerCase()})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">What is serviced</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={field}
            >
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">How often</span>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
                className={field}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                {editing ? 'Next due' : 'First due'}
              </span>
              <input
                type="date"
                value={nextDue}
                min={editing ? undefined : today()}
                onChange={(e) => setNextDue(e.target.value)}
                className={field}
              />
            </label>
          </div>

          {equipmentHere.length > 0 && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                A particular item (optional)
              </span>
              <select
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                className={field}
              >
                <option value="">The unit in general</option>
                {equipmentHere.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.type.replace(/_/g, ' ').toLowerCase()}
                    {e.serialNumber ? `, ${e.serialNumber}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {vacant && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Nobody lives in this unit, so each repair it raises is a work order with no tenant.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 border-t border-gray-200 p-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!valid || submitting}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The recurring repairs for the properties this person looks after: when each is next due, whether
 * it is running, and the way to add, change, pause or remove one. The daily job raises a repair
 * when one falls due (a work order with no tenant if the unit is empty).
 */
export function MaintenanceSchedules() {
  const { data, loading, error, refetch } = useMaintenanceSchedules();
  const update = useUpdateSchedule();
  const remove = useDeleteSchedule();
  const [form, setForm] = useState<{ schedule?: MaintenanceSchedule } | null>(null);
  const [removing, setRemoving] = useState<MaintenanceSchedule | null>(null);

  const toggle = async (s: MaintenanceSchedule) => {
    try {
      await update.submit(s.id, { isActive: !s.isActive });
      toast.success(s.isActive ? 'Paused. It raises nothing until you resume it.' : 'Resumed.');
      refetch();
    } catch {
      toast.error('That could not be changed.');
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await remove.submit(removing.id);
      toast.success('Schedule removed. Repairs it already raised stay.');
      setRemoving(null);
      refetch();
    } catch {
      toast.error('That could not be removed.');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Recurring maintenance</h1>
          <p className="mt-1 text-sm text-gray-500">
            Servicing that should happen on a rhythm: the daily job raises a repair when each one
            falls due and asks you to find a vendor. An empty unit gets a work order with no tenant.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm({})}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New schedule
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <CalendarClock className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">
            Nothing is scheduled yet. Add a schedule for the servicing a unit needs every month,
            quarter or year.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map((s) => (
            <li
              key={s.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 ${
                s.isActive ? 'border-gray-200' : 'border-gray-200 opacity-70'
              }`}
            >
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">
                  {s.category?.name ?? 'Maintenance'}{' '}
                  <span className="text-sm font-normal text-gray-500">
                    {frequencyLabel(s.frequency).toLowerCase()}
                  </span>
                  {!s.isActive && (
                    <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                      Paused
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-gray-600">
                  {s.unit?.property?.name}, unit {s.unit?.unitNumber}
                  {s.unit?.status === 'VACANT' ? ' (vacant)' : ''}
                  {s.equipment
                    ? `, ${s.equipment.type.replace(/_/g, ' ').toLowerCase()}${
                        s.equipment.serialNumber ? ` ${s.equipment.serialNumber}` : ''
                      }`
                    : ''}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Next due {day(s.nextDueDate)}
                  {s.lastGeneratedAt ? ` · last raised ${day(s.lastGeneratedAt)}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => toggle(s)}
                  disabled={update.submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {s.isActive ? (
                    <>
                      <Pause className="h-4 w-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Resume
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ schedule: s })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setRemoving(s)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <ScheduleForm
          schedule={form.schedule}
          onClose={() => setForm(null)}
          onDone={() => {
            setForm(null);
            refetch();
          }}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        title="Remove this schedule?"
        description="It stops raising repairs. Repairs it already raised stay. To keep it but stop it for now, pause it instead."
        confirmLabel="Remove schedule"
        isLoading={remove.submitting}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
