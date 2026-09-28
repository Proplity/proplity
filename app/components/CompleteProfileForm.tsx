'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, AlertCircle, Upload, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { uploadFile, uploadsEnabled } from '@/lib/uploadClient';
import { missingTenantProfileFields } from '@/lib/tenantProfile';

// Filled in once here and reused everywhere a tenant would otherwise be
// asked to re-type it (PropertyApplicationForm's old References/Documents
// steps collected a subset of this same data on every single application).
// Gates PropertyApplicationForm via isTenantProfileComplete() -- see
// app/dashboard/properties/[id]/apply/page.tsx.
export function CompleteProfileForm() {
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.user) return;
    setPhoneNumber(auth.user.phoneNumber ?? '');
    setYearOfBirth(auth.user.yearOfBirth ? String(auth.user.yearOfBirth) : '');
    setEmergencyContactName(auth.user.emergencyContactName ?? '');
    setEmergencyContactRelationship(auth.user.emergencyContactRelationship ?? '');
    setEmergencyContactPhone(auth.user.emergencyContactPhone ?? '');
    setPreviousLandlordPhone(auth.user.previousLandlordPhone ?? '');
    setPreviousLandlordEmail(auth.user.previousLandlordEmail ?? '');
    setIdDocumentUrl(auth.user.idDocumentUrl ?? null);
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
      router.push(next || '/dashboard');
    } catch {
      setError('Failed to save your profile');
    } finally {
      setSubmitting(false);
    }
  };

  const missing = auth.user ? missingTenantProfileFields(auth.user) : [];

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

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-lg border border-gray-200 bg-white p-6"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Phone Number *</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Year of Birth *
              </label>
              <input
                type="number"
                value={yearOfBirth}
                onChange={(e) => setYearOfBirth(e.target.value)}
                min={1900}
                max={new Date().getFullYear()}
                placeholder="e.g. 1995"
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h2 className="mb-3 font-medium">Emergency Contact *</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Full Name *</label>
                <input
                  type="text"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Phone *</label>
                  <input
                    type="tel"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Relationship *
                  </label>
                  <input
                    type="text"
                    value={emergencyContactRelationship}
                    onChange={(e) => setEmergencyContactRelationship(e.target.value)}
                    placeholder="e.g., Parent, Sibling"
                    required
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
                  onChange={(e) => setPreviousLandlordPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={previousLandlordEmail}
                  onChange={(e) => setPreviousLandlordEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h2 className="mb-3 font-medium">Identification *</h2>
            {!uploadsEnabled() && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Document upload isn&apos;t available in this environment yet. You can still select
                  a file, but only its name will be recorded.
                </span>
              </div>
            )}
            <label className="block cursor-pointer">
              <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 hover:bg-gray-50">
                <Upload className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {uploading
                    ? 'Uploading…'
                    : (idDocumentUrl ?? idDocumentName)
                      ? (idDocumentName ?? 'ID on file')
                      : 'Choose a valid ID (Driver’s License, Passport, or National ID)'}
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

          {missing.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Fields marked * are required before you can apply to a property.</span>
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
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
