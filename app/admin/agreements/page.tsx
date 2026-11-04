'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2, MapPinned, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import { Switch } from '@/app/components/ui/switch';
import { RENT_ACTIVATION_RULES } from '@/lib/agreementOptions';
import { AUTO_RENEWAL_DAYS, UNSIGNED_REMINDER_DAYS, parseReminderDays } from '@/lib/renewalOptions';
import type { AdminPlatformSettings } from '@/lib/api/types';
import { JurisdictionsPanel } from './JurisdictionsPanel';
import { TemplatesPanel } from './TemplatesPanel';
import { SwitchRow, message } from './ui';

const TABS = [
  { id: 'rules', label: 'Rules', icon: Scale },
  { id: 'jurisdictions', label: 'Jurisdictions', icon: MapPinned },
  { id: 'templates', label: 'Templates', icon: FileText },
] as const;

type SettingsBody = Parameters<typeof api.admin.settings.update>[0];

function RulesPanel() {
  const [settings, setSettings] = useState<AdminPlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkDays, setLinkDays] = useState('14');
  const [stampFee, setStampFee] = useState('0');
  const [reminderDays, setReminderDays] = useState('');
  const [unsignedDays, setUnsignedDays] = useState('3');
  const [autoDays, setAutoDays] = useState('60');

  useEffect(() => {
    api.admin.settings
      .get()
      .then((res) => {
        setSettings(res.data.data);
        setLinkDays(String(res.data.data.witnessLinkDays));
        setStampFee(String(res.data.data.stampDutyServiceFee));
        setReminderDays(res.data.data.renewalReminderDays.join(', '));
        setUnsignedDays(String(res.data.data.agreementUnsignedReminderDays));
        setAutoDays(String(res.data.data.autoRenewalDaysBefore));
      })
      .catch(() => toast.error('Failed to load the agreement rules.'));
  }, []);

  const save = async (body: SettingsBody) => {
    setSaving(true);
    try {
      const res = await api.admin.settings.update(body);
      setSettings(res.data.data);
      setLinkDays(String(res.data.data.witnessLinkDays));
      setStampFee(String(res.data.data.stampDutyServiceFee));
      setReminderDays(res.data.data.renewalReminderDays.join(', '));
      setUnsignedDays(String(res.data.data.agreementUnsignedReminderDays));
      setAutoDays(String(res.data.data.autoRenewalDaysBefore));
      toast.success('Saved.');
    } catch (err) {
      toast.error(message(err, 'Failed to save. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <Loader2 className="h-5 w-5 animate-spin text-gray-400" />;

  const toggle = (
    key:
      | 'agreementTemplatesNeedApproval'
      | 'agreementLandlordNameByManager'
      | 'agreementAgencyFee'
      | 'agreementLegalFee'
      | 'agreementCautionFee'
      | 'chargeForAgreements'
      | 'chargeForUploads'
      | 'witnessEsignEnabled'
      | 'witnessesMustSign'
      | 'stampDutyPaymentEnabled'
      | 'agreementRenewalEnabled'
      | 'agreementRemindersEnabled'
      | 'autoRenewalEnabled',
    label: string,
  ) => (
    <Switch
      checked={settings[key]}
      disabled={saving}
      onCheckedChange={(checked) => save({ [key]: checked })}
      aria-label={label}
    />
  );

  return (
    <div className="space-y-4">
      <SwitchRow
        title="Templates must be approved before use"
        hint="On: managers can only make agreements from an approved template, so a lawyer can review the wording first. Off: the newest draft or approved version of each template can be used straight away."
      >
        {toggle('agreementTemplatesNeedApproval', 'Templates must be approved before use')}
      </SwitchRow>
      <SwitchRow
        title="The manager may type the owner's name"
        hint="When a property has no landlord account, the manager types the owner's name on the agreement and the agent is noted. Off: the property needs a landlord account first."
      >
        {toggle('agreementLandlordNameByManager', "The manager may type the owner's name")}
      </SwitchRow>
      <SwitchRow
        title="Offer a caution deposit"
        hint="Shows the caution deposit on the agreement form."
      >
        {toggle('agreementCautionFee', 'Offer a caution deposit')}
      </SwitchRow>
      <SwitchRow
        title="Offer an agency fee"
        hint="Shows an optional agency fee on the agreement form."
      >
        {toggle('agreementAgencyFee', 'Offer an agency fee')}
      </SwitchRow>
      <SwitchRow
        title="Offer a legal fee"
        hint="Shows an optional legal fee on the agreement form."
      >
        {toggle('agreementLegalFee', 'Offer a legal fee')}
      </SwitchRow>

      <div className="space-y-2 rounded-lg border border-gray-200 p-4">
        <fieldset disabled={saving} className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-gray-900">When a rent starts</legend>
          {RENT_ACTIVATION_RULES.map((o) => (
            <label
              key={o.value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${settings.rentActivationRule === o.value ? 'border-blue-500 bg-blue-50/40' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <input
                type="radio"
                name="rent-activation"
                checked={settings.rentActivationRule === o.value}
                onChange={() => save({ rentActivationRule: o.value })}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">{o.label}</span>
                <span className="block text-xs text-gray-600">{o.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </div>

      <SwitchRow
        title="Witnesses can sign by email"
        hint="Lets the property team (and the tenant, for their own witness) email a witness a link to read the agreement and sign with their name. Off: witnesses are names typed on the agreement and signed on paper."
      >
        {toggle('witnessEsignEnabled', 'Witnesses can sign by email')}
      </SwitchRow>
      <SwitchRow
        title="An agreement waits for its witnesses"
        hint="On: an agreement that needs witnesses is not signed (and its rent does not start on signing) until a witness on each side has signed by email. Off: witnesses are recorded but never hold the agreement up."
      >
        {toggle('witnessesMustSign', 'An agreement waits for its witnesses')}
      </SwitchRow>
      <div className="flex items-end gap-3 rounded-lg border border-gray-200 p-4">
        <label className="block w-48">
          <span className="mb-1 block text-xs font-medium text-gray-700">
            Witness link works for (days)
          </span>
          <input
            type="number"
            min={1}
            max={90}
            value={linkDays}
            onChange={(e) => setLinkDays(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={saving || Number(linkDays) === settings.witnessLinkDays}
          onClick={() => save({ witnessLinkDays: Number(linkDays) })}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Save days
        </button>
      </div>

      <SwitchRow
        title="People can pay stamp duty through Proplity"
        hint="Shows a Pay stamp duty button on a signed agreement. The person pays the quoted duty (from the rates under Jurisdictions) plus the fee below by card, and your staff pay the tax authority and add the receipt at Stamp duty in this menu. Switch on only when someone is ready to do that."
      >
        {toggle('stampDutyPaymentEnabled', 'People can pay stamp duty through Proplity')}
      </SwitchRow>
      <div className="flex items-end gap-3 rounded-lg border border-gray-200 p-4">
        <label className="block w-48">
          <span className="mb-1 block text-xs font-medium text-gray-700">
            Stamp duty service fee (₦)
          </span>
          <input
            type="number"
            min={0}
            value={stampFee}
            onChange={(e) => setStampFee(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={saving || Number(stampFee) === settings.stampDutyServiceFee}
          onClick={() => save({ stampDutyServiceFee: Number(stampFee) })}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Save fee
        </button>
      </div>

      <SwitchRow
        title="Renew a rent with a new agreement"
        hint="Shows a Renew button that makes the next rent (pending, with its first invoice) and, if the person wants, a draft agreement copied from the current one. The new rent starts once it is signed and its start date arrives; the old one ends then. Off: renewing is the older one-step change with no new agreement."
      >
        {toggle('agreementRenewalEnabled', 'Renew a rent with a new agreement')}
      </SwitchRow>
      <SwitchRow
        title="Send agreement and renewal reminders"
        hint="Reminds the tenant and the property team as a rent end date approaches (on the days below), when a rent has ended but is still marked active, and when an agreement has been sent but not signed."
      >
        {toggle('agreementRemindersEnabled', 'Send agreement and renewal reminders')}
      </SwitchRow>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 p-4">
        <label className="block w-56">
          <span className="mb-1 block text-xs font-medium text-gray-700">
            Remind this many days before a rent ends
          </span>
          <input
            value={reminderDays}
            onChange={(e) => setReminderDays(e.target.value)}
            placeholder="90, 60, 30"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => save({ renewalReminderDays: parseReminderDays(reminderDays) })}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Save days
        </button>
        <label className="block w-56">
          <span className="mb-1 block text-xs font-medium text-gray-700">
            Remind about an unsigned agreement after (days, 0 = never)
          </span>
          <input
            type="number"
            min={UNSIGNED_REMINDER_DAYS.min}
            max={UNSIGNED_REMINDER_DAYS.max}
            value={unsignedDays}
            onChange={(e) => setUnsignedDays(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={saving || Number(unsignedDays) === settings.agreementUnsignedReminderDays}
          onClick={() => save({ agreementUnsignedReminderDays: Number(unsignedDays) })}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Save
        </button>
      </div>
      <SwitchRow
        title="Rents can renew automatically"
        hint="Lets a landlord or manager mark a rent to renew automatically. Shortly before it ends, the next rent and a draft agreement are prepared for a person to review and send; nothing reaches the tenant until they do. Off: no rent is prepared this way, whatever its setting."
      >
        {toggle('autoRenewalEnabled', 'Rents can renew automatically')}
      </SwitchRow>
      <div className="flex items-end gap-3 rounded-lg border border-gray-200 p-4">
        <label className="block w-48">
          <span className="mb-1 block text-xs font-medium text-gray-700">
            Prepare the renewal this many days before
          </span>
          <input
            type="number"
            min={AUTO_RENEWAL_DAYS.min}
            max={AUTO_RENEWAL_DAYS.max}
            value={autoDays}
            onChange={(e) => setAutoDays(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={saving || Number(autoDays) === settings.autoRenewalDaysBefore}
          onClick={() => save({ autoRenewalDaysBefore: Number(autoDays) })}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Save days
        </button>
      </div>

      <SwitchRow
        title="Charge credits to make an agreement"
        hint="Takes the credits the Rent agreement service costs (Admin > Plans & billing) when a manager makes an agreement from a template. Off while billing is not live."
      >
        {toggle('chargeForAgreements', 'Charge credits to make an agreement')}
      </SwitchRow>
      <SwitchRow
        title="Charge credits to upload an existing agreement"
        hint="Uploading an agreement you already have is free unless this is on."
      >
        {toggle('chargeForUploads', 'Charge credits to upload an existing agreement')}
      </SwitchRow>
    </div>
  );
}

export default function AdminAgreementsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('rules');

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Rent agreements</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          The rules, places and wording behind rent agreements. Everything here is yours to change
          without a release. The starting jurisdictions and templates have not been reviewed by a
          lawyer.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap ${
              tab === id
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        {tab === 'rules' && <RulesPanel />}
        {tab === 'jurisdictions' && <JurisdictionsPanel />}
        {tab === 'templates' && <TemplatesPanel />}
      </section>
    </div>
  );
}
