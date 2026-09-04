'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock, Landmark, Star, Trash2, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  useBankAccounts,
  useCreateBankAccount,
  useSetDefaultBankAccount,
  useDeleteBankAccount,
} from '@/hooks/useBankAccounts';

// Change password (app/api/v1/auth/change-password) and bank accounts
// (app/api/v1/bank-accounts) both existed with zero UI before this page.
// Profile editing (PATCH /auth/me) was added alongside this page's own
// ProfileCard -- deliberately narrow (name/phone/bio only): no email
// (needs its own re-verification flow) and no avatar (no file-storage
// endpoint exists anywhere in this codebase to upload one to).
export function AccountSettings() {
  const router = useRouter();
  const auth = useAuth();
  const showBankAccounts =
    auth.user && ['manager', 'landlord', 'vendor', 'admin'].includes(auth.user.role);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold">Account Settings</h1>
          <p className="text-sm text-gray-500">
            {auth.user?.name} · {auth.user?.email}
          </p>
        </div>
      </div>

      <ProfileCard />
      <ChangePasswordCard />
      {showBankAccounts && <BankAccountsCard />}
    </div>
  );
}

function ProfileCard() {
  const auth = useAuth();
  const [name, setName] = useState(auth.user?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(auth.user?.phoneNumber ?? '');
  const [bio, setBio] = useState(auth.user?.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // auth.user resolves asynchronously (AuthContext fetches /auth/me on
  // mount) -- the fields above start empty and need to pick up the real
  // values once it lands, same pattern BankAccountsCard's own hooks use.
  useEffect(() => {
    setName(auth.user?.name ?? '');
    setPhoneNumber(auth.user?.phoneNumber ?? '');
    setBio(auth.user?.bio ?? '');
  }, [auth.user?.name, auth.user?.phoneNumber, auth.user?.bio]);

  const handleSubmit = async () => {
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phoneNumber: phoneNumber.trim() || null,
          bio: bio.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to update profile');
        return;
      }
      await auth.refreshUser();
      setSaved(true);
    } catch {
      setError('Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <UserIcon className="h-5 w-5 text-gray-600" />
        <h2 className="font-semibold">Profile</h2>
      </div>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Full name</label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            placeholder="Full name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Phone number</label>
          <input
            value={phoneNumber}
            onChange={(e) => {
              setPhoneNumber(e.target.value);
              setSaved(false);
            }}
            placeholder="+234 803 000 0000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => {
              setBio(e.target.value);
              setSaved(false);
            }}
            placeholder="A short note about yourself"
            rows={3}
            maxLength={500}
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && !error && <p className="text-sm text-green-600">Profile updated.</p>}
        <button
          onClick={handleSubmit}
          disabled={submitting || !name.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to change password');
        return;
      }
      // The route revokes every refresh token and clears cookies on
      // success, so the session is already dead -- send them to log back in.
      router.push('/login');
    } catch {
      setError('Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Lock className="h-5 w-5 text-gray-600" />
        <h2 className="font-semibold">Change Password</h2>
      </div>
      <div className="space-y-3">
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Current password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password (min. 6 characters)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Updating…' : 'Update Password'}
        </button>
        <p className="text-xs text-gray-400">
          You'll be signed out on other devices and asked to log in again.
        </p>
      </div>
    </div>
  );
}

// No Paystack/payout automation reads this table yet (CLAUDE.md's
// documented gap) -- this is real storage for real bank details, honestly
// not yet wired to any payout flow.
function BankAccountsCard() {
  const { data: accounts, loading, refetch } = useBankAccounts();
  const {
    submit: createAccount,
    submitting: creating,
    error: createError,
  } = useCreateBankAccount();
  const { submit: setDefault } = useSetDefaultBankAccount();
  const { submit: removeAccount } = useDeleteBankAccount();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    accountNumber: '',
    bankCode: '',
    bankName: '',
    accountName: '',
  });

  const handleCreate = async () => {
    if (!form.accountNumber || !form.bankCode || !form.bankName || !form.accountName) return;
    try {
      await createAccount(form);
      setForm({ accountNumber: '', bankCode: '', bankName: '', accountName: '' });
      setShowForm(false);
      refetch();
    } catch {
      // error surfaced below
    }
  };

  const handleSetDefault = async (id: string) => {
    await setDefault(id);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this bank account?')) return;
    await removeAccount(id);
    refetch();
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-gray-600" />
          <h2 className="font-semibold">Bank Accounts</h2>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {showForm ? 'Cancel' : '+ Add Account'}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 space-y-2 border-b border-gray-100 pb-4">
          <input
            value={form.accountNumber}
            onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
            placeholder="10-digit account number (NUBAN)"
            maxLength={10}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <input
            value={form.bankName}
            onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
            placeholder="Bank name (e.g. GTBank)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <input
            value={form.bankCode}
            onChange={(e) => setForm((f) => ({ ...f, bankCode: e.target.value }))}
            placeholder="Bank code (e.g. 058)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <input
            value={form.accountName}
            onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
            placeholder="Account name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          {createError && <p className="text-xs text-red-600">{createError}</p>}
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Adding…' : 'Add Bank Account'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {loading && <p className="text-sm text-gray-400">Loading…</p>}
        {!loading &&
          accounts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {a.bankName} · {a.accountNumber}
                </p>
                <p className="text-xs text-gray-500">{a.accountName}</p>
              </div>
              <div className="flex items-center gap-2">
                {a.isDefault ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    Default
                  </span>
                ) : (
                  <button
                    onClick={() => handleSetDefault(a.id)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => handleDelete(a.id)}
                  className="text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        {!loading && accounts.length === 0 && (
          <p className="text-sm text-gray-400">No bank accounts added yet.</p>
        )}
      </div>
    </div>
  );
}
