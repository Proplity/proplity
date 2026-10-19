'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  AlertCircle,
  Upload,
  CheckCircle,
  CheckCircle2,
  BadgeCheck,
  ShieldCheck,
  Building2,
  Landmark,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { uploadFile, uploadsEnabled } from '@/lib/uploadClient';
import { missingTenantProfileFields, isTenantProfileComplete } from '@/lib/tenantProfile';

export interface CompleteProfileFormProps {
  embedded?: boolean;
  onSuccess?: () => void;
  onSwitchTab?: (tab: 'general' | 'completion' | 'banking') => void;
}

// Filled in once here and reused everywhere a tenant would otherwise be
// asked to re-type it (PropertyApplicationForm's old References/Documents
// steps collected a subset of this same data on every single application).
// Gates PropertyApplicationForm via isTenantProfileComplete() -- see
// app/dashboard/properties/[id]/apply/page.tsx.
export function CompleteProfileForm({
  embedded = false,
  onSuccess,
  onSwitchTab,
}: CompleteProfileFormProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const auth = useAuth();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [yearOfBirth, setYearOfBirth] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [previousLandlordPhone, setPreviousLandlordPhone] = useState('');
  const [previousLandlordEmail, setPreviousLandlordEmail] = useState('');
  const [idDocumentUrl, setIdDocumentUrl] = useState<string | null>(null);
  const [idDocumentName, setIdDocumentName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.user) return;
    const timer = setTimeout(() => {
      setPhoneNumber(auth.user?.phoneNumber ?? '');
      setYearOfBirth(auth.user?.yearOfBirth ? String(auth.user?.yearOfBirth) : '');
      setEmergencyContactName(auth.user?.emergencyContactName ?? '');
      setEmergencyContactRelationship(auth.user?.emergencyContactRelationship ?? '');
      setEmergencyContactPhone(auth.user?.emergencyContactPhone ?? '');
      setPreviousLandlordPhone(auth.user?.previousLandlordPhone ?? '');
      setPreviousLandlordEmail(auth.user?.previousLandlordEmail ?? '');
      setIdDocumentUrl(auth.user?.idDocumentUrl ?? null);
    }, 0);
    return () => clearTimeout(timer);
  }, [auth.user]);

  const handleFileUpload = async (file: File | null) => {
    if (!file) {
      setIdDocumentUrl(null);
      setIdDocumentName(null);
      return;
    }
    if (!uploadsEnabled()) {
      setIdDocumentName(file.name);
      setIdDocumentUrl(null);
      return;
    }
    setUploading(true);
    setError(null);
    setSaved(false);
    try {
      const uploaded = await uploadFile(file, 'profile');
      setIdDocumentUrl(uploaded.url);
      setIdDocumentName(uploaded.name);
    } catch {
      setError(`${file.name} failed to upload. Please try again.`);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim() || null,
          yearOfBirth: yearOfBirth ? parseInt(yearOfBirth, 10) : null,
          emergencyContactName: emergencyContactName.trim() || null,
          emergencyContactRelationship: emergencyContactRelationship.trim() || null,
          emergencyContactPhone: emergencyContactPhone.trim() || null,
          previousLandlordPhone: previousLandlordPhone.trim() || null,
          previousLandlordEmail: previousLandlordEmail.trim() || null,
          // Falls back to just the filename when no upload provider is
          // configured (see the /auth/me route's comment on this field).
          idDocumentUrl: idDocumentUrl || idDocumentName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save your profile');
        return;
      }
      await auth.refreshUser();
      setSaved(true);
      if (next) {
        router.push(next);
      } else if (!embedded) {
        router.push('/dashboard');
      }
      onSuccess?.();
    } catch {
      setError('Failed to save your profile');
    } finally {
      setSubmitting(false);
    }
  };

  const isTenant = auth.user?.role === 'tenant';
  const missing = auth.user ? missingTenantProfileFields(auth.user) : [];
  const isComplete = isTenant ? missing.length === 0 : false;
  const completedCount = 6 - missing.length;
  const progressPercent = Math.round((completedCount / 6) * 100);

  const content = (
    <div className="space-y-6">
      {/* Role-Specific Completion Overview */}
      {isTenant && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Tenant Profile Readiness</h2>
              <p className="text-xs text-gray-500">
                Required once for all property applications and digital lease agreements
              </p>
            </div>
            <div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  isComplete ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                )}
                {isComplete ? '100% Complete' : `${progressPercent}% Completed`}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-blue-600'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Checklist Pills */}
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div
              className={`flex items-center gap-1.5 rounded-lg p-2 ${
                phoneNumber ? 'bg-green-50 font-medium text-green-800' : 'bg-gray-50 text-gray-500'
              }`}
            >
              <span>{phoneNumber ? '✓' : '○'}</span>
              <span>Phone Number</span>
            </div>
            <div
              className={`flex items-center gap-1.5 rounded-lg p-2 ${
                yearOfBirth ? 'bg-green-50 font-medium text-green-800' : 'bg-gray-50 text-gray-500'
              }`}
            >
              <span>{yearOfBirth ? '✓' : '○'}</span>
              <span>Year of Birth</span>
            </div>
            <div
              className={`flex items-center gap-1.5 rounded-lg p-2 ${
                emergencyContactName
                  ? 'bg-green-50 font-medium text-green-800'
                  : 'bg-gray-50 text-gray-500'
              }`}
            >
              <span>{emergencyContactName ? '✓' : '○'}</span>
              <span>Emergency Name</span>
            </div>
            <div
              className={`flex items-center gap-1.5 rounded-lg p-2 ${
                emergencyContactPhone
                  ? 'bg-green-50 font-medium text-green-800'
                  : 'bg-gray-50 text-gray-500'
              }`}
            >
              <span>{emergencyContactPhone ? '✓' : '○'}</span>
              <span>Emergency Phone</span>
            </div>
            <div
              className={`flex items-center gap-1.5 rounded-lg p-2 ${
                emergencyContactRelationship
                  ? 'bg-green-50 font-medium text-green-800'
                  : 'bg-gray-50 text-gray-500'
              }`}
            >
              <span>{emergencyContactRelationship ? '✓' : '○'}</span>
              <span>Relationship</span>
            </div>
            <div
              className={`flex items-center gap-1.5 rounded-lg p-2 ${
                idDocumentUrl || idDocumentName
                  ? 'bg-green-50 font-medium text-green-800'
                  : 'bg-gray-50 text-gray-500'
              }`}
            >
              <span>{idDocumentUrl || idDocumentName ? '✓' : '○'}</span>
              <span>Government ID</span>
            </div>
          </div>
        </div>
      )}

      {/* Non-Tenant Setup & Readiness Card */}
      {!isTenant && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                {auth.user?.role === 'landlord'
                  ? 'Landlord Setup & Verification'
                  : auth.user?.role === 'vendor'
                    ? 'Service Provider Setup & Verification'
                    : 'Management Verification & Setup'}
              </h2>
              <p className="text-xs text-gray-500">
                Configure your verification details and operational credentials
              </p>
            </div>
            {auth.user?.vendorVerification && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  auth.user.vendorVerification === 'VERIFIED'
                    ? 'bg-green-100 text-green-800'
                    : auth.user.vendorVerification === 'REJECTED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                {auth.user.vendorVerification === 'VERIFIED' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                )}
                Verification: {auth.user.vendorVerification}
              </span>
            )}
          </div>

          {/* Quick checklist */}
          <div className="space-y-2 pt-1 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-2.5">
              <div className="flex items-center gap-2">
                <span className={phoneNumber ? 'font-bold text-green-600' : 'text-gray-400'}>
                  {phoneNumber ? '✓' : '○'}
                </span>
                <span className="font-medium text-gray-700">Contact Details (Phone & Bio)</span>
              </div>
              <span className="text-gray-500">{phoneNumber ? 'Configured' : 'Needed'}</span>
            </div>

            {onSwitchTab && (
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-2.5">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-gray-500" />
                  <span className="font-medium text-gray-700">Payout Bank Account</span>
                </div>
                <button
                  type="button"
                  onClick={() => onSwitchTab('banking')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Manage Banking Details →
                </button>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={
                    idDocumentUrl || idDocumentName ? 'font-bold text-green-600' : 'text-gray-400'
                  }
                >
                  {idDocumentUrl || idDocumentName ? '✓' : '○'}
                </span>
                <span className="font-medium text-gray-700">
                  Identity / Business Document Verification
                </span>
              </div>
              <span className="text-gray-500">
                {idDocumentUrl || idDocumentName ? 'Document on File' : 'Pending Upload'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Verification Form */}
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-lg border border-gray-200 bg-white p-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Phone Number {isTenant && '*'}
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                setSaved(false);
              }}
              required={isTenant}
              placeholder="+234 803 000 0000"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Year of Birth {isTenant && '*'}
            </label>
            <input
              type="number"
              value={yearOfBirth}
              onChange={(e) => {
                setYearOfBirth(e.target.value);
                setSaved(false);
              }}
              min={1900}
              max={new Date().getFullYear()}
              placeholder="e.g. 1995"
              required={isTenant}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <h2 className="mb-3 font-medium">Emergency Contact {isTenant && '*'}</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Full Name {isTenant && '*'}
              </label>
              <input
                type="text"
                value={emergencyContactName}
                onChange={(e) => {
                  setEmergencyContactName(e.target.value);
                  setSaved(false);
                }}
                required={isTenant}
                placeholder="Emergency contact full name"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Phone {isTenant && '*'}
                </label>
                <input
                  type="tel"
                  value={emergencyContactPhone}
                  onChange={(e) => {
                    setEmergencyContactPhone(e.target.value);
                    setSaved(false);
                  }}
                  required={isTenant}
                  placeholder="+234 803 000 0000"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Relationship {isTenant && '*'}
                </label>
                <input
                  type="text"
                  value={emergencyContactRelationship}
                  onChange={(e) => {
                    setEmergencyContactRelationship(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="e.g., Parent, Sibling, Spouse"
                  required={isTenant}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <h2 className="mb-3 font-medium">Previous Landlord (Optional)</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                value={previousLandlordPhone}
                onChange={(e) => {
                  setPreviousLandlordPhone(e.target.value);
                  setSaved(false);
                }}
                placeholder="+234 800 000 0000"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={previousLandlordEmail}
                onChange={(e) => {
                  setPreviousLandlordEmail(e.target.value);
                  setSaved(false);
                }}
                placeholder="landlord@example.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <h2 className="mb-3 font-medium">Identification Document {isTenant && '*'}</h2>
          {!uploadsEnabled() && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Document upload isn&apos;t available in this environment yet. You can still select a
                file, but only its name will be recorded.
              </span>
            </div>
          )}
          <label className="block cursor-pointer">
            <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 transition-colors hover:bg-gray-50">
              <Upload className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-600">
                {uploading
                  ? 'Uploading…'
                  : (idDocumentUrl ?? idDocumentName)
                    ? (idDocumentName ?? 'Government ID on file')
                    : 'Choose a valid ID (Driver’s License, International Passport, or National ID)'}
              </span>
            </div>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => handleFileUpload(e.target.files?.[0] || null)}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {missing.length > 0 && isTenant && (
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Fields marked * are required before you can apply to a property.</span>
          </div>
        )}

        {saved && !error && (
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            <span>Profile and verification details saved successfully!</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Save Profile & Verification'}
        </button>
      </form>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <h1 className="mb-2 text-2xl font-bold">Complete Your Profile</h1>
        <p className="mb-6 text-gray-600">
          This is filled in once and reused for every property you apply to — no need to re-enter it
          each time.
        </p>

        {content}
      </div>
    </div>
  );
}
