'use client';

import { useCallback, useEffect, useState } from 'react';
import { Coins, Layers, Loader2, Plus, ReceiptText, Scale, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import { Switch } from '@/app/components/ui/switch';
import {
  DOWNGRADE_GRACE_DAYS,
  DOWNGRADE_RULES,
  OVERAGE_MODES,
  TEAM_MEMBER_ACCESS,
  UNIT_BILLING_OWNERS,
} from '@/lib/billingOptions';
import type { AdminPlatformSettings, CreditPack, PaidService, Plan } from '@/lib/api/types';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500';

function message(err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

// A blank cell means "none" for the two optional prices; anything else is whole naira.
const optionalNumber = (v: string) => (v.trim() === '' ? null : Number(v));

function Section({
  icon: Icon,
  title,
  intro,
  children,
}: {
  icon: typeof Scale;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-5 flex gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
          <Icon className="h-4.5 w-4.5 text-blue-600" />
        </div>
        <div>
          <h2 className="font-medium text-gray-900">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">{intro}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

// ── The rules ──────────────────────────────────────────────────────────────────────────────────

function ChoiceGroup<T extends string>({
  legend,
  value,
  options,
  disabled,
  onChange,
}: {
  legend: string;
  value: T;
  options: readonly { value: T; label: string; hint: string }[];
  disabled: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium text-gray-900">{legend}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${value === o.value ? 'border-blue-500 bg-blue-50/40' : 'border-gray-200 hover:bg-gray-50'}`}
        >
          <input
            type="radio"
            name={legend}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium text-gray-900">{o.label}</span>
            <span className="block text-xs text-gray-600">{o.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function RulesSection() {
  const [settings, setSettings] = useState<AdminPlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [graceDays, setGraceDays] = useState(String(DOWNGRADE_GRACE_DAYS.default));

  useEffect(() => {
    api.admin.settings
      .get()
      .then((res) => {
        setSettings(res.data.data);
        setGraceDays(String(res.data.data.downgradeGraceDays));
      })
      .catch(() => toast.error('Failed to load the plan rules.'));
  }, []);

  const save = async (body: Parameters<typeof api.admin.settings.update>[0]) => {
    setSaving(true);
    try {
      const res = await api.admin.settings.update(body);
      setSettings(res.data.data);
      setGraceDays(String(res.data.data.downgradeGraceDays));
      toast.success('Plan rules saved.');
    } catch (err) {
      toast.error(message(err, 'Failed to save. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <Section icon={Scale} title="Plan rules" intro="Loading…">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </Section>
    );
  }

  return (
    <Section
      icon={Scale}
      title="Plan rules"
      intro="How the limits behave. Each rule is yours to change at any time; it applies from the next request."
    >
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-6 rounded-lg bg-gray-50 p-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Enforce plan limits</p>
            <p className="mt-1 max-w-xl text-xs text-gray-600">
              Off while billing is not live: with it on and nobody able to pay, a free account stays
              at its included units. Usage is still shown on the dashboards either way.
            </p>
          </div>
          <Switch
            checked={settings.enforcePlanLimits}
            disabled={saving}
            onCheckedChange={(checked) => save({ enforcePlanLimits: checked })}
            aria-label="Enforce plan limits"
          />
        </div>

        <div className="flex items-start justify-between gap-6 rounded-lg bg-gray-50 p-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Let people buy credits</p>
            <p className="mt-1 max-w-xl text-xs text-gray-600">
              Shows the credit packs below to managers and landlords, who pay by card. Switched off,
              the buy buttons disappear; a purchase already started can still be paid and credited.
            </p>
          </div>
          <Switch
            checked={settings.creditPurchaseEnabled}
            disabled={saving}
            onCheckedChange={(checked) => save({ creditPurchaseEnabled: checked })}
            aria-label="Let people buy credits"
          />
        </div>

        <ChoiceGroup
          legend="Whose plan the units of a property count against"
          value={settings.unitBillingOwner}
          options={UNIT_BILLING_OWNERS}
          disabled={saving}
          onChange={(v) => save({ unitBillingOwner: v })}
        />
        <ChoiceGroup
          legend="When someone adds units beyond what their plan includes"
          value={settings.overageMode}
          options={OVERAGE_MODES}
          disabled={saving}
          onChange={(v) => save({ overageMode: v })}
        />
        <ChoiceGroup
          legend="What a member of a company's team sees of its properties"
          value={settings.teamMemberAccess}
          options={TEAM_MEMBER_ACCESS}
          disabled={saving}
          onChange={(v) => save({ teamMemberAccess: v })}
        />
        <ChoiceGroup
          legend="When someone moves to a plan that includes fewer units than they have"
          value={settings.downgradeRule}
          options={DOWNGRADE_RULES}
          disabled={saving}
          onChange={(v) => save({ downgradeRule: v })}
        />
        <div className="flex items-end gap-3">
          <div className="w-48">
            <Field
              label="Grace period (days)"
              hint={`Used when the rule above is a grace period (${DOWNGRADE_GRACE_DAYS.min} to ${DOWNGRADE_GRACE_DAYS.max}).`}
            >
              <input
                type="number"
                min={DOWNGRADE_GRACE_DAYS.min}
                max={DOWNGRADE_GRACE_DAYS.max}
                value={graceDays}
                onChange={(e) => setGraceDays(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <button
            type="button"
            disabled={saving || Number(graceDays) === settings.downgradeGraceDays}
            onClick={() => save({ downgradeGraceDays: Number(graceDays) })}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Save days
          </button>
        </div>
      </div>
    </Section>
  );
}

// ── Plans ──────────────────────────────────────────────────────────────────────────────────────

type PlanDraft = {
  key: string;
  name: string;
  tagline: string;
  monthlyPrice: string;
  yearlyPrice: string;
  unitsIncluded: string;
  usersIncluded: string;
  overagePerUnit: string;
  monthlyCredits: string;
  features: string;
  isDefault: boolean;
  isActive: boolean;
  isPopular: boolean;
  sortOrder: string;
};

const draftOf = (p?: Plan): PlanDraft => ({
  key: p?.key ?? '',
  name: p?.name ?? '',
  tagline: p?.tagline ?? '',
  monthlyPrice: String(p?.monthlyPrice ?? 0),
  yearlyPrice: p?.yearlyPrice == null ? '' : String(p.yearlyPrice),
  unitsIncluded: String(p?.unitsIncluded ?? 1),
  usersIncluded: String(p?.usersIncluded ?? 1),
  overagePerUnit: p?.overagePerUnit == null ? '' : String(p.overagePerUnit),
  monthlyCredits: String(p?.monthlyCredits ?? 0),
  features: (p?.features ?? []).join('\n'),
  isDefault: p?.isDefault ?? false,
  isActive: p?.isActive ?? true,
  isPopular: p?.isPopular ?? false,
  sortOrder: String(p?.sortOrder ?? 10),
});

const bodyOf = (d: PlanDraft) => ({
  name: d.name,
  tagline: d.tagline.trim() === '' ? null : d.tagline,
  monthlyPrice: Number(d.monthlyPrice),
  yearlyPrice: optionalNumber(d.yearlyPrice),
  unitsIncluded: Number(d.unitsIncluded),
  usersIncluded: Number(d.usersIncluded),
  overagePerUnit: optionalNumber(d.overagePerUnit),
  monthlyCredits: Number(d.monthlyCredits),
  features: d.features
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean),
  isDefault: d.isDefault,
  isActive: d.isActive,
  isPopular: d.isPopular,
  sortOrder: Number(d.sortOrder),
});

function PlanCard({
  plan,
  onSaved,
  onCancel,
}: {
  plan?: Plan;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<PlanDraft>(() => draftOf(plan));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof PlanDraft>(k: K, v: PlanDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      if (plan) await api.admin.plans.update(plan.id, bodyOf(draft));
      else await api.admin.plans.create({ key: draft.key, ...bodyOf(draft) });
      toast.success(plan ? `${draft.name} saved.` : `${draft.name} created.`);
      onSaved();
    } catch (err) {
      toast.error(message(err, 'Failed to save the plan.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!plan || !window.confirm(`Delete the ${plan.name} plan?`)) return;
    setSaving(true);
    try {
      await api.admin.plans.remove(plan.id);
      toast.success(`${plan.name} deleted.`);
      onSaved();
    } catch (err) {
      toast.error(message(err, 'Failed to delete the plan.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-lg border border-gray-200 p-4"
      data-testid={`plan-${plan?.key ?? 'new'}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-gray-900">{plan ? plan.name : 'New plan'}</h3>
        {plan?.isDefault && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            Default
          </span>
        )}
        {plan && !plan.isActive && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            Switched off
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Key" hint={plan ? 'Fixed once created' : 'Lower-case, for example small'}>
          <input
            className={inputClass}
            value={draft.key}
            disabled={!!plan}
            onChange={(e) => set('key', e.target.value)}
          />
        </Field>
        <Field label="Name">
          <input
            className={inputClass}
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Tagline">
            <input
              className={inputClass}
              value={draft.tagline}
              onChange={(e) => set('tagline', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Price per month (₦)" hint="0 for a free plan">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={draft.monthlyPrice}
            onChange={(e) => set('monthlyPrice', e.target.value)}
          />
        </Field>
        <Field label="Price per year (₦)" hint="Blank = no yearly option">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={draft.yearlyPrice}
            onChange={(e) => set('yearlyPrice', e.target.value)}
          />
        </Field>
        <Field label="Units included">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={draft.unitsIncluded}
            onChange={(e) => set('unitsIncluded', e.target.value)}
          />
        </Field>
        <Field label="Users included">
          <input
            type="number"
            min={1}
            className={inputClass}
            value={draft.usersIncluded}
            onChange={(e) => set('usersIncluded', e.target.value)}
          />
        </Field>
        <Field label="Each extra unit (₦ per month)" hint="Blank = cannot go over">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={draft.overagePerUnit}
            onChange={(e) => set('overagePerUnit', e.target.value)}
          />
        </Field>
        <Field label="Credits every month">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={draft.monthlyCredits}
            onChange={(e) => set('monthlyCredits', e.target.value)}
          />
        </Field>
        <Field label="Order on the page" hint="Lowest first">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={draft.sortOrder}
            onChange={(e) => set('sortOrder', e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2 lg:col-span-4">
          <Field label="Bullet points" hint="One per line, shown after the numbers above">
            <textarea
              rows={3}
              className={inputClass}
              value={draft.features}
              onChange={(e) => set('features', e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-700">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
          />
          Available to choose
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.isPopular}
            onChange={(e) => set('isPopular', e.target.checked)}
          />
          Mark as most popular
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.isDefault}
            disabled={plan?.isDefault}
            onChange={(e) => set('isDefault', e.target.checked)}
          />
          Default plan (everyone without a paid plan; must be free)
        </label>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : plan ? 'Save plan' : 'Create plan'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        {plan && !plan.isDefault && (
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="ml-auto flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function PlansSection() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.admin.plans
      .list()
      .then((res) => setPlans(res.data.data))
      .catch(() => toast.error('Failed to load the plans.'));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <Section
      icon={Layers}
      title="Plans"
      intro="The plans people can choose, with their price, what they include and what an extra unit costs. The pricing page, checkout and the limits all read from here. The starting numbers are placeholders until you set real ones."
    >
      {!plans ? (
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      ) : (
        <div className="space-y-4">
          {plans.map((p) => (
            <PlanCard key={`${p.id}-${p.name}`} plan={p} onSaved={load} />
          ))}
          {adding ? (
            <PlanCard
              onSaved={() => {
                setAdding(false);
                load();
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              Add a plan
            </button>
          )}
        </div>
      )}
    </Section>
  );
}

// ── Services and credits ───────────────────────────────────────────────────────────────────────

function ServiceRow({ service, onSaved }: { service: PaidService; onSaved: () => void }) {
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? '');
  const [cost, setCost] = useState(String(service.creditCost));
  const [active, setActive] = useState(service.isActive);
  const [saving, setSaving] = useState(false);
  const dirty =
    name !== service.name ||
    description !== (service.description ?? '') ||
    Number(cost) !== service.creditCost ||
    active !== service.isActive;

  const save = async () => {
    setSaving(true);
    try {
      await api.admin.services.update(service.id, {
        name,
        description: description.trim() === '' ? null : description,
        creditCost: Number(cost),
        isActive: active,
      });
      toast.success(`${name} saved.`);
      onSaved();
    } catch (err) {
      toast.error(message(err, 'Failed to save the service.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${service.name}"?`)) return;
    try {
      await api.admin.services.remove(service.id);
      onSaved();
    } catch (err) {
      toast.error(message(err, 'Failed to delete the service.'));
    }
  };

  return (
    <div className="grid grid-cols-1 items-end gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-[1fr_2fr_7rem_auto]">
      <Field label={`Name (${service.key})`}>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description">
        <input
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field label="Credits">
        <input
          type="number"
          min={0}
          className={inputClass}
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
      </Field>
      <div className="flex items-center gap-3 pb-2">
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          On
        </label>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={save}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
        >
          Save
        </button>
        <button type="button" onClick={remove} aria-label={`Delete ${service.name}`}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </button>
      </div>
    </div>
  );
}

function ServicesSection() {
  const [services, setServices] = useState<PaidService[] | null>(null);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [cost, setCost] = useState('1');
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.admin.services
      .list()
      .then((res) => setServices(res.data.data))
      .catch(() => toast.error('Failed to load the services.'));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    setAdding(true);
    try {
      await api.admin.services.create({ key, name, creditCost: Number(cost) });
      setKey('');
      setName('');
      setCost('1');
      load();
    } catch (err) {
      toast.error(message(err, 'Failed to add the service.'));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Section
      icon={ReceiptText}
      title="Paid services"
      intro="Extras a manager or landlord pays for in credits, for example generating a rent agreement. Switch one off to stop it being offered; its price is the number of credits it uses."
    >
      {!services ? (
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      ) : (
        <div className="space-y-3">
          {services.map((s) => (
            <ServiceRow
              key={`${s.id}-${s.name}-${s.creditCost}-${s.isActive}`}
              service={s}
              onSaved={load}
            />
          ))}
          <div className="grid grid-cols-1 items-end gap-3 rounded-lg border border-dashed border-gray-300 p-3 sm:grid-cols-[1fr_1fr_7rem_auto]">
            <Field label="Key" hint="Lower-case, for example id_check">
              <input className={inputClass} value={key} onChange={(e) => setKey(e.target.value)} />
            </Field>
            <Field label="Name">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Credits">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </Field>
            <button
              type="button"
              disabled={adding || !key || !name}
              onClick={add}
              className="mb-0.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Add service
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

function CreditPackRow({ pack, onSaved }: { pack: CreditPack; onSaved: () => void }) {
  const [name, setName] = useState(pack.name);
  const [credits, setCredits] = useState(String(pack.credits));
  const [price, setPrice] = useState(String(pack.price));
  const [active, setActive] = useState(pack.isActive);
  const [saving, setSaving] = useState(false);
  const dirty =
    name !== pack.name ||
    Number(credits) !== pack.credits ||
    Number(price) !== pack.price ||
    active !== pack.isActive;

  const save = async () => {
    setSaving(true);
    try {
      await api.admin.creditPacks.update(pack.id, {
        name,
        credits: Number(credits),
        price: Number(price),
        isActive: active,
      });
      toast.success(`${name} saved.`);
      onSaved();
    } catch (err) {
      toast.error(message(err, 'Failed to save the pack.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${pack.name}"?`)) return;
    try {
      await api.admin.creditPacks.remove(pack.id);
      onSaved();
    } catch (err) {
      toast.error(message(err, 'Failed to delete the pack.'));
    }
  };

  return (
    <div className="grid grid-cols-1 items-end gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-[2fr_7rem_9rem_auto]">
      <Field label={`Name (${pack.key})`}>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Credits">
        <input
          type="number"
          min={1}
          className={inputClass}
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
        />
      </Field>
      <Field label="Price (₦)">
        <input
          type="number"
          min={1}
          className={inputClass}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </Field>
      <div className="flex items-center gap-3 pb-2">
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          On sale
        </label>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={save}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
        >
          Save
        </button>
        <button type="button" onClick={remove} aria-label={`Delete ${pack.name}`}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </button>
      </div>
    </div>
  );
}

function CreditPacksSection() {
  const [packs, setPacks] = useState<CreditPack[] | null>(null);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [credits, setCredits] = useState('10');
  const [price, setPrice] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.admin.creditPacks
      .list()
      .then((res) => setPacks(res.data.data))
      .catch(() => toast.error('Failed to load the credit packs.'));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    setAdding(true);
    try {
      await api.admin.creditPacks.create({
        key,
        name,
        credits: Number(credits),
        price: Number(price),
      });
      setKey('');
      setName('');
      setCredits('10');
      setPrice('');
      load();
    } catch (err) {
      toast.error(message(err, 'Failed to add the pack.'));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Section
      icon={Coins}
      title="Credit packs"
      intro="The packs a manager or landlord can buy with a card. A change reaches purchases started afterwards; one already started keeps the credits and price it was made at. The shop itself is switched on or off under Plan rules."
    >
      {!packs ? (
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      ) : (
        <div className="space-y-3">
          {packs.map((p) => (
            <CreditPackRow
              key={`${p.id}-${p.name}-${p.credits}-${p.price}-${p.isActive}`}
              pack={p}
              onSaved={load}
            />
          ))}
          <div className="grid grid-cols-1 items-end gap-3 rounded-lg border border-dashed border-gray-300 p-3 sm:grid-cols-[1fr_1fr_7rem_9rem_auto]">
            <Field label="Key" hint="Lower-case, for example credits-100">
              <input className={inputClass} value={key} onChange={(e) => setKey(e.target.value)} />
            </Field>
            <Field label="Name">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Credits">
              <input
                type="number"
                min={1}
                className={inputClass}
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
              />
            </Field>
            <Field label="Price (₦)">
              <input
                type="number"
                min={1}
                className={inputClass}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
            <button
              type="button"
              disabled={adding || !key || !name || !price}
              onClick={add}
              className="mb-0.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Add pack
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

function CreditsSection() {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const grant = async () => {
    setSaving(true);
    try {
      const res = await api.admin.credits.grant({
        email,
        amount: Number(amount),
        ...(note.trim() ? { note } : {}),
      });
      toast.success(`${res.data.data.name ?? email} now has ${res.data.data.balance} credits.`);
      setAmount('');
      setNote('');
    } catch (err) {
      toast.error(message(err, 'Failed to change the credits.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      icon={Coins}
      title="Credits"
      intro="Add credits to a manager or landlord by email address, or take some back with a negative number (never below 0). Every change is logged."
    >
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[2fr_8rem_2fr_auto]">
        <Field label="Email address">
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Credits (+ or −)">
          <input
            type="number"
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Note (optional)">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <button
          type="button"
          disabled={saving || !email || !amount}
          onClick={grant}
          className="mb-0.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
        >
          Apply
        </button>
      </div>
    </Section>
  );
}

export default function AdminPlansPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Layers className="h-5 w-5" />
          Plans &amp; billing
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Plans, what they include, the rules for going over, credits and paid services. Everything
          here can be changed without a release.
        </p>
      </div>
      <RulesSection />
      <PlansSection />
      <ServicesSection />
      <CreditPacksSection />
      <CreditsSection />
    </div>
  );
}
