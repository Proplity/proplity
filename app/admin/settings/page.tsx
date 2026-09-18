'use client';

import { useEffect, useState } from 'react';
import { Loader2, Settings as SettingsIcon, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import { Switch } from '@/app/components/ui/switch';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoComplete, setAutoComplete] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.admin.settings
      .get()
      .then((res) => {
        if (!cancelled) setAutoComplete(res.data.data.autoCompleteMaintenanceOnInvoice);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load platform settings.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = async (checked: boolean) => {
    const previous = autoComplete;
    setAutoComplete(checked);
    setSaving(true);
    try {
      await api.admin.settings.update({ autoCompleteMaintenanceOnInvoice: checked });
      toast.success('Platform settings updated.');
    } catch {
      setAutoComplete(previous);
      toast.error('Failed to update setting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <SettingsIcon className="h-5 w-5" />
          Platform Settings
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Platform-wide behavior, applied across every property and role.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <Wrench className="h-4.5 w-4.5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Auto-complete maintenance jobs on invoice</p>
              <p className="mt-1 max-w-xl text-sm text-gray-600">
                When on (default), a vendor submitting an invoice for a maintenance request
                automatically marks that request as Completed. Turn this off if your vendors invoice
                interim costs (e.g. materials) partway through a job and you don&apos;t want that to
                close it out.
              </p>
            </div>
          </div>
          <Switch checked={autoComplete} disabled={saving} onCheckedChange={handleToggle} />
        </div>
      </div>
    </div>
  );
}
