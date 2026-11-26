'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

// The admin area's own sign-in. Same endpoint family as the public one but a different door:
// only an administrator gets through, and the public sign-in refuses an administrator
// (lib/auth/loginFlow.ts). Deliberately plain and dark so nobody mistakes it for the public page.
// The labels and button name match the public form so one test helper can drive both.
export function AdminLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password resets are sent from the public site, which is where the link in the email points.
  const forgotHref = `${(process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')}/forgot-password`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);
    const res = await login({ email, password, rememberMe: false }, { admin: true });
    setLoading(false);

    if (res.success) {
      toast.success('Signed in.');
      onSignedIn();
    } else {
      const msg = res.error || 'Invalid email or password';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-emerald-400 ring-1 ring-slate-700">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Admin sign in</h1>
          <p className="mt-1.5 text-sm text-slate-400">Proplity platform administration</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-black/30">
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="admin-email"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Email address
              </label>
              <div className="relative">
                <Mail
                  className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pr-3 pl-10 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pr-10 pl-10 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          <a
            href={forgotHref}
            className="text-slate-400 underline-offset-4 hover:text-white hover:underline"
          >
            Forgot your password?
          </a>
        </p>
        <p className="mt-2 text-center text-xs text-slate-600">
          Tenants, landlords, managers and vendors sign in on the main site.
        </p>
      </div>
    </div>
  );
}
