'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LogoIcon } from '../components/Logo';
import {
  Shield,
  Lock,
  Mail,
  User,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface SetupWizardFormProps {
  requiresToken: boolean;
}

export function SetupWizardForm({ requiresToken }: SetupWizardFormProps) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [createdAdminEmail, setCreatedAdminEmail] = useState('');

  // Password validation indicators
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage('A valid email address is required.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (!hasLetter || !hasNumber) {
      setErrorMessage('Password must contain both letters and numbers.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (requiresToken && !setupToken.trim()) {
      setErrorMessage('Setup Token is required by server environment configuration.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/v1/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(setupToken.trim() ? { 'x-setup-token': setupToken.trim() } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          ...(setupToken.trim() ? { setupToken: setupToken.trim() } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete setup');
      }

      setIsCompleted(true);
      setCreatedAdminEmail(email.trim().toLowerCase());
      toast.success('Platform administrator initialized successfully!');

      // Automatic redirect after 3.5s
      setTimeout(() => {
        router.push('/login');
      }, 3500);
    } catch (err: any) {
      const msg = err.message || 'An unexpected error occurred during setup.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
        {/* Ambient background glow */}
        <div className="pointer-events-none absolute top-1/4 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-600/20 blur-3xl" />

        <div className="animate-in fade-in zoom-in-95 relative z-10 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl duration-500">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="h-8 w-8" />
          </div>

          <h2 className="mb-2 text-2xl font-bold text-white">Platform Initialized!</h2>
          <p className="mb-6 text-sm leading-relaxed text-slate-400">
            The administrator account for{' '}
            <span className="font-medium text-white">{createdAdminEmail}</span> has been created.
            The setup wizard has permanently self-terminated.
          </p>

          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wider text-emerald-400 uppercase">
              <Check className="h-3.5 w-3.5" /> Security Sealed
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              Superadmin privileges are now locked. All further administrative actions require
              active authenticated credentials.
            </p>
          </div>

          <button
            onClick={() => router.push('/login')}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-500"
          >
            <span>Proceed to Login</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4 py-12">
      {/* Dynamic backdrop glows */}
      <div className="pointer-events-none absolute top-0 right-1/4 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-800/80 bg-slate-900 p-8 shadow-2xl sm:p-10">
        {/* Brand & Setup Header */}
        <div className="mb-8 flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <LogoIcon size={36} />
            <div>
              <span className="block text-lg font-bold tracking-tight text-white">Proplity</span>
              <span className="text-xs text-slate-400">Core Infrastructure</span>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            First-Run Setup
          </div>
        </div>

        <div className="mb-8">
          <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            <Shield className="h-6 w-6 text-blue-400" />
            Initialize Administrator
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Welcome to your Proplity instance. Configure the primary platform administrator. This
            wizard will self-disable immediately upon completion.
          </p>
        </div>

        {errorMessage && (
          <div className="animate-in fade-in mb-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Administrator Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium tracking-wider text-slate-300 uppercase">
              Administrator Name
            </label>
            <div className="relative">
              <User className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. System Administrator"
                disabled={isSubmitting}
                required
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pr-4 pl-10 text-sm text-white transition-colors placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
              />
            </div>
          </div>

          {/* Administrator Email */}
          <div>
            <label className="mb-1.5 block text-xs font-medium tracking-wider text-slate-300 uppercase">
              Admin Email Address
            </label>
            <div className="relative">
              <Mail className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@yourdomain.com"
                disabled={isSubmitting}
                required
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pr-4 pl-10 text-sm text-white transition-colors placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Account will be auto-verified and granted root ADMIN privileges immediately.
            </p>
          </div>

          {/* Defense-in-depth: Setup Token (when configured) */}
          {requiresToken && (
            <div className="rounded-xl border border-amber-500/20 bg-slate-950/70 p-4">
              <div className="mb-2 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-400" />
                <label className="block text-xs font-semibold tracking-wider text-amber-300 uppercase">
                  Deployment Setup Token
                </label>
              </div>
              <input
                type="password"
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                placeholder="Enter SETUP_TOKEN from your environment"
                disabled={isSubmitting}
                required
                className="w-full rounded-lg border border-slate-700/80 bg-slate-900 px-3.5 py-2.5 font-mono text-sm text-white transition-colors placeholder:text-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none disabled:opacity-60"
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Matches the <code className="font-mono text-amber-400">SETUP_TOKEN</code> configured
                in your deployment environment variables.
              </p>
            </div>
          )}

          {/* Password Fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium tracking-wider text-slate-300 uppercase">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 chars"
                  disabled={isSubmitting}
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pr-10 pl-10 text-sm text-white transition-colors placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-slate-500 transition-colors hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium tracking-wider text-slate-300 uppercase">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  disabled={isSubmitting}
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pr-10 pl-10 text-sm text-white transition-colors placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-slate-500 transition-colors hover:text-slate-300"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Password checklist */}
          <div className="space-y-1.5 rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`h-3.5 w-3.5 ${hasMinLength ? 'text-emerald-400' : 'text-slate-600'}`}
              />
              <span className={hasMinLength ? 'text-slate-300' : 'text-slate-500'}>
                At least 8 characters
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`h-3.5 w-3.5 ${hasLetter && hasNumber ? 'text-emerald-400' : 'text-slate-600'}`}
              />
              <span className={hasLetter && hasNumber ? 'text-slate-300' : 'text-slate-500'}>
                Contains both letters and numbers
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`h-3.5 w-3.5 ${passwordsMatch ? 'text-emerald-400' : 'text-slate-600'}`}
              />
              <span className={passwordsMatch ? 'text-slate-300' : 'text-slate-500'}>
                Passwords match
              </span>
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isSubmitting || !passwordsMatch || !hasMinLength || !hasLetter || !hasNumber}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Bootstrapping Superadmin...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>Complete Platform Setup</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-800/80 pt-6 text-center">
          <p className="text-xs text-slate-500">
            Self-hosting or local development? Run{' '}
            <code className="rounded bg-slate-950 px-1.5 py-0.5 text-slate-400">
              pnpm prisma db seed
            </code>{' '}
            to bypass setup with demo accounts.
          </p>
        </div>
      </div>
    </div>
  );
}
