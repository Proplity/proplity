'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useMyProperties } from '@/hooks/useProperties';
import {
  useMaintenanceCategories,
  useCreateMaintenanceRequest,
} from '@/hooks/useMaintenanceRequests';
import { useVendors } from '@/hooks/useVendors';

const field =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';

/**
 * A repair the property team raises itself: on any unit it looks after, occupied or vacant, with or
 * without a vendor yet. It is not a tenant's report, so nobody is asked to confirm it; the property
 * team pays the vendor as for any repair.
 */
export function RaiseRepairForm({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (requestId: string) => void;
}) {
  const { data: properties, loading: loadingProperties } = useMyProperties();
  const { data: categories } = useMaintenanceCategories();
  const { data: vendors } = useVendors();
  const { submit, submitting, error } = useCreateMaintenanceRequest();

  const [propertyId, setPropertyId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY'>('MEDIUM');
  const [vendorId, setVendorId] = useState('');

  const property = properties.find((p) => p.id === propertyId);
  const units = property?.units ?? [];
  const valid = !!unitId && title.trim().length >= 3 && description.trim().length >= 3;

  const send = async () => {
    if (!valid) return;
    try {
      const res = await submit({
        unitId,
        title: title.trim(),
        description: description.trim(),
        priority,
        ...(categoryId ? { categoryId } : {}),
        ...(vendorId ? { vendorId } : {}),
      });
      toast.success(
        vendorId
          ? 'Work order raised and given to the vendor.'
          : 'Work order raised. Assign a vendor from its page.',
      );
      onDone(res.data.data.id);
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
        aria-label="Raise a repair"
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-5">
          <div>
            <h2 className="text-lg font-semibold">Raise a repair</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              For work you want done yourself, on any unit you look after, even an empty one. There
              is no tenant to confirm it; you pay the vendor as usual.
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
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Property</span>
              <select
                value={propertyId}
                onChange={(e) => {
                  setPropertyId(e.target.value);
                  setUnitId('');
                }}
                className={field}
              >
                <option value="">{loadingProperties ? 'Loading…' : 'Choose a property'}</option>
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
                onChange={(e) => setUnitId(e.target.value)}
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

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">What needs doing</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Repaint the vacant flat"
              className={field}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Details</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What the vendor should know before they go"
              className={field}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Category (optional)</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={field}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className={field}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="EMERGENCY">Emergency</option>
              </select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Vendor (optional)</span>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className={field}
            >
              <option value="">Choose one later</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.businessName || v.name}
                </option>
              ))}
            </select>
          </label>

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
            onClick={send}
            disabled={!valid || submitting}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Raise repair'}
          </button>
        </div>
      </div>
    </div>
  );
}
