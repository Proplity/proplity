'use client';

import { useEffect, useState } from 'react';
import {
  ClipboardCheck,
  Loader2,
  Settings as SettingsIcon,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import { Switch } from '@/app/components/ui/switch';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoComplete, setAutoComplete] = useState(true);
  const [confirmRepairs, setConfirmRepairs] = useState(true);
  const [secondPersonTenant, setSecondPersonTenant] = useState(true);
  const [secondPersonVendor, setSecondPersonVendor] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.admin.settings
      .get()
      .then((res) => {
        if (cancelled) return;
        setAutoComplete(res.data.data.autoCompleteMaintenanceOnInvoice);
        setConfirmRepairs(res.data.data.requireTenantRepairConfirmation);
        setSecondPersonTenant(res.data.data.requireSecondPersonForTenantPayments);
        setSecondPersonVendor(res.data.data.requireSecondPersonForVendorPayments);
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

  const handleSecondPersonToggle = async (
    key: 'requireSecondPersonForTenantPayments' | 'requireSecondPersonForVendorPayments',
    set: (value: boolean) => void,
    previous: boolean,
    checked: boolean,
  ) => {
    set(checked);
    setSaving(true);
    try {
      await api.admin.settings.update({ [key]: checked });
      toast.success('Platform settings updated.');
    } catch {
      set(previous);
      toast.error('Failed to update setting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmToggle = async (checked: boolean) => {
    const previous = confirmRepairs;
    setConfirmRepairs(checked);
    setSaving(true);
    try {
      await api.admin.settings.update({ requireTenantRepairConfirmation: checked });
      toast.success('Platform settings updated.');
    } catch {
      setConfirmRepairs(previous);
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
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
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
          <Switch
            checked={autoComplete}
            disabled={saving}
            onCheckedChange={handleToggle}
            aria-label="Auto-complete maintenance jobs on invoice"
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50">
              <ClipboardCheck className="h-4.5 w-4.5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Ask tenants to confirm finished repairs</p>
              <p className="mt-1 max-w-xl text-sm text-gray-600">
                When on (default), a repair the vendor finishes asks the tenant to confirm it is
                fixed or say it is still a problem. A problem goes to the property manager, who can
                send it back to the vendor, give it to another one, or approve it anyway. It never
                holds up payment. Turning this off stops new requests; repairs already waiting for
                an answer can still be answered.
              </p>
            </div>
          </div>
          <Switch
            checked={confirmRepairs}
            disabled={saving}
            onCheckedChange={handleConfirmToggle}
            aria-label="Ask tenants to confirm finished repairs"
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
              <ShieldCheck className="h-4.5 w-4.5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                Second person confirms what a tenant is recorded as paying
              </p>
              <p className="mt-1 max-w-xl text-sm text-gray-600">
                When on (default), cash or a transfer that the property team records on a
                tenant&apos;s record does not count until someone other than the person who entered
                it confirms it on Bank Transfers. Only then is the invoice paid and a receipt
                issued. Turn this off for a small property with one person on the team: their entry
                counts at once (still logged, with the receipt). A tenant recording their own
                transfer is always confirmed by the team.
              </p>
            </div>
          </div>
          <Switch
            checked={secondPersonTenant}
            disabled={saving}
            onCheckedChange={(checked) =>
              handleSecondPersonToggle(
                'requireSecondPersonForTenantPayments',
                setSecondPersonTenant,
                secondPersonTenant,
                checked,
              )
            }
            aria-label="Second person confirms what a tenant is recorded as paying"
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
              <ShieldCheck className="h-4.5 w-4.5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                Second person confirms what is paid to a vendor
              </p>
              <p className="mt-1 max-w-xl text-sm text-gray-600">
                When on (default), a payment to a vendor that the property team records by hand (a
                transfer or cash, from the repair&apos;s Cost Tracking card) does not count until
                someone other than the person who entered it confirms it. Turn this off and the
                recorder&apos;s own entry counts at once (still logged, with the receipt and the
                vendor told). Paying a vendor by card is not affected.
              </p>
            </div>
          </div>
          <Switch
            checked={secondPersonVendor}
            disabled={saving}
            onCheckedChange={(checked) =>
              handleSecondPersonToggle(
                'requireSecondPersonForVendorPayments',
                setSecondPersonVendor,
                secondPersonVendor,
                checked,
              )
            }
            aria-label="Second person confirms what is paid to a vendor"
          />
        </div>
      </div>
    </div>
  );
}
