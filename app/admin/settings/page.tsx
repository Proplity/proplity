'use client';

import { useEffect, useState } from 'react';
import {
  ClipboardCheck,
  CreditCard,
  FileX2,
  Loader2,
  MailPlus,
  Settings as SettingsIcon,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import { Switch } from '@/app/components/ui/switch';
import { RETENTION_LIMITS } from '@/lib/retentionLimits';
import { INVITE_LIMITS } from '@/lib/inviteLimits';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoComplete, setAutoComplete] = useState(true);
  const [confirmRepairs, setConfirmRepairs] = useState(true);
  const [secondPersonTenant, setSecondPersonTenant] = useState(true);
  const [secondPersonVendor, setSecondPersonVendor] = useState(true);
  const [autopayOn, setAutopayOn] = useState(false);
  const [retentionOn, setRetentionOn] = useState(false);
  const [tenancyDays, setTenancyDays] = useState('365');
  const [rejectionDays, setRejectionDays] = useState('90');
  const [invitesPerDay, setInvitesPerDay] = useState(String(INVITE_LIMITS.perDay.default));
  const [deploymentAllows, setDeploymentAllows] = useState({ autopay: false, retention: false });
  // Turning on a charge or a deletion asks once more before it saves.
  const [confirming, setConfirming] = useState<'autopay' | 'retention' | null>(null);

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
        setAutopayOn(res.data.data.autopayChargingEnabled);
        setRetentionOn(res.data.data.retentionEnabled);
        setTenancyDays(String(res.data.data.retentionAfterTenancyDays));
        setRejectionDays(String(res.data.data.retentionAfterRejectionDays));
        setInvitesPerDay(String(res.data.data.tenantInvitesPerDay));
        setDeploymentAllows(res.data.data.deploymentAllows);
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

  const saveSwitch = async (
    key: 'autopayChargingEnabled' | 'retentionEnabled',
    set: (value: boolean) => void,
    checked: boolean,
  ) => {
    setSaving(true);
    try {
      await api.admin.settings.update({ [key]: checked });
      set(checked);
      toast.success('Platform settings updated.');
    } catch {
      toast.error('Failed to update setting. Please try again.');
    } finally {
      setSaving(false);
      setConfirming(null);
    }
  };

  const savePeriods = async () => {
    const tenancy = Number(tenancyDays);
    const rejection = Number(rejectionDays);
    setSaving(true);
    try {
      const res = await api.admin.settings.update({
        retentionAfterTenancyDays: tenancy,
        retentionAfterRejectionDays: rejection,
      });
      setTenancyDays(String(res.data.data.retentionAfterTenancyDays));
      setRejectionDays(String(res.data.data.retentionAfterRejectionDays));
      toast.success('Retention periods saved.');
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(message ?? 'Failed to save the periods. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveInviteCap = async () => {
    setSaving(true);
    try {
      const res = await api.admin.settings.update({ tenantInvitesPerDay: Number(invitesPerDay) });
      setInvitesPerDay(String(res.data.data.tenantInvitesPerDay));
      toast.success('Invitation limit saved.');
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(message ?? 'Failed to save the limit. Please try again.');
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

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <CreditCard className="h-4.5 w-4.5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Charge auto-pay tenants automatically</p>
              <p className="mt-1 max-w-xl text-sm text-gray-600">
                When on, the daily job charges the saved card of every tenant who set up auto-pay
                when a rent invoice falls due. Off by default: it moves real money and has not yet
                been tried against live Paystack. While off, the job only reports which invoices it
                would charge.
              </p>
              {!deploymentAllows.autopay && (
                <p className="mt-2 max-w-xl text-sm text-amber-700">
                  This deployment does not allow automatic charging yet (AUTOPAY_WORKER_ENABLED is
                  not set), so nothing is charged even when this is on.
                </p>
              )}
              {confirming === 'autopay' && (
                <div className="mt-3 max-w-xl rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Turn on automatic charging? Real cards will be charged on the next daily run.
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => saveSwitch('autopayChargingEnabled', setAutopayOn, true)}
                      disabled={saving}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      Yes, turn on
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <Switch
            checked={autopayOn}
            disabled={saving}
            onCheckedChange={(checked) =>
              checked
                ? setConfirming('autopay')
                : saveSwitch('autopayChargingEnabled', setAutopayOn, false)
            }
            aria-label="Charge auto-pay tenants automatically"
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50">
              <FileX2 className="h-4.5 w-4.5 text-red-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                Delete identity documents when kept long enough
              </p>
              <p className="mt-1 max-w-xl text-sm text-gray-600">
                When on, the daily job permanently deletes a person&apos;s ID documents once their
                last tenancy ended, or their last application was rejected, longer ago than the
                periods below. This cannot be undone. Off by default; confirm the periods with
                whoever owns compliance first. While off, the job only reports what it would delete.
              </p>
              {!deploymentAllows.retention && (
                <p className="mt-2 max-w-xl text-sm text-amber-700">
                  This deployment does not allow deletion yet (RETENTION_ENABLED is not set), so
                  nothing is deleted even when this is on.
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-end gap-4">
                <label className="text-sm text-gray-700">
                  Days after a tenancy ends
                  <input
                    type="number"
                    min={RETENTION_LIMITS.tenancyDays.min}
                    max={RETENTION_LIMITS.tenancyDays.max}
                    value={tenancyDays}
                    onChange={(e) => setTenancyDays(e.target.value)}
                    aria-label="Days to keep ID documents after a tenancy ends"
                    className="mt-1 block w-36 rounded-lg border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm text-gray-700">
                  Days after a rejected application
                  <input
                    type="number"
                    min={RETENTION_LIMITS.rejectionDays.min}
                    max={RETENTION_LIMITS.rejectionDays.max}
                    value={rejectionDays}
                    onChange={(e) => setRejectionDays(e.target.value)}
                    aria-label="Days to keep ID documents after a rejected application"
                    className="mt-1 block w-36 rounded-lg border border-gray-300 px-3 py-2"
                  />
                </label>
                <button
                  onClick={savePeriods}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Save periods
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                At least {RETENTION_LIMITS.tenancyDays.min} days after a tenancy and{' '}
                {RETENTION_LIMITS.rejectionDays.min} days after a rejection (365 days is 12 months).
              </p>
              {confirming === 'retention' && (
                <div className="mt-3 max-w-xl rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  Turn on deletion? Matching ID documents are deleted for good on the next daily
                  run.
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => saveSwitch('retentionEnabled', setRetentionOn, true)}
                      disabled={saving}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Yes, turn on
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <Switch
            checked={retentionOn}
            disabled={saving}
            onCheckedChange={(checked) =>
              checked
                ? setConfirming('retention')
                : saveSwitch('retentionEnabled', setRetentionOn, false)
            }
            aria-label="Delete identity documents when kept long enough"
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <MailPlus className="h-4.5 w-4.5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Tenant invitations by email</p>
            <p className="mt-1 max-w-xl text-sm text-gray-600">
              When a manager or landlord starts a lease for an email address with no account,
              Proplity emails that person an invitation. This is how many new people one manager or
              landlord can invite in a day. They can only do it on a listing an admin has approved.
              Admins are not limited. Set 0 to stop invitations.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <label className="text-sm text-gray-700">
                Invitations per person per day
                <input
                  type="number"
                  min={INVITE_LIMITS.perDay.min}
                  max={INVITE_LIMITS.perDay.max}
                  value={invitesPerDay}
                  onChange={(e) => setInvitesPerDay(e.target.value)}
                  aria-label="New people one manager or landlord may invite by email each day"
                  className="mt-1 block w-36 rounded-lg border border-gray-300 px-3 py-2"
                />
              </label>
              <button
                onClick={saveInviteCap}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save limit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
