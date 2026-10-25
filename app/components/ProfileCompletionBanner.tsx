'use client';

import Link from 'next/link';
import { UserCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isTenantProfileComplete } from '@/lib/tenantProfile';

// A tenant added by their landlord or manager signs in with only a name and email. Until the rest
// of the profile (phone, year of birth, emergency contact, ID) is filled in, say so at the top of
// their dashboard instead of leaving it for the first time they try to apply somewhere.
export function ProfileCompletionBanner() {
  const auth = useAuth();
  const user = auth.user;
  if (!user || user.role !== 'tenant' || isTenantProfileComplete(user)) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-semibold text-amber-900">Finish your profile</p>
          <p className="mt-0.5 text-sm text-amber-800">
            Add your phone number, year of birth, emergency contact and ID so your landlord or
            manager has what they need on file. It takes a few minutes.
          </p>
        </div>
      </div>
      <Link
        href="/dashboard/profile/complete"
        className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
      >
        Complete profile
      </Link>
    </div>
  );
}
