import { useState } from 'react';
import { toast } from 'sonner';
import { LogoIcon } from '../Logo';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface LoginProps {
  onLogin: (role: string) => void;
  onSwitchToRegister: () => void;
  onForgotPassword: () => void;
}

const DEMO_ACCOUNTS: Record<string, { email: string; password: string }> = {
  admin: { email: 'admin@proplity.com', password: 'Password123!' },
  manager: { email: 'manager@proplity.com', password: 'Password123!' },
  landlord: { email: 'landlord@proplity.com', password: 'Password123!' },
  tenant: { email: 'tenant@proplity.com', password: 'Password123!' },
  vendor: { email: 'vendor@proplity.com', password: 'Password123!' },
};

export function Login({ onLogin, onSwitchToRegister, onForgotPassword }: LoginProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const res = await login({ email, password, rememberMe });
    setLoading(false);

    if (res.success && res.user?.role) {
      toast.success(`Welcome back, ${res.user.name ?? 'there'}!`);
      onLogin(res.user.role.toLowerCase());
    } else {
      const msg = res.error || 'Invalid credentials';
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  const handleDemoLogin = async (role: string) => {
    const creds = DEMO_ACCOUNTS[role.toLowerCase()];
    if (creds) {
      setErrorMessage(null);
      setLoading(true);
      const res = await login({ ...creds, rememberMe: true });
      setLoading(false);
      if (res.success && res.user?.role) {
        toast.success(`Welcome back, ${res.user.name ?? 'there'}!`);
        onLogin(res.user.role.toLowerCase());
      } else {
        const msg = res.error || 'Demo login failed';
        setErrorMessage(msg);
        toast.error(msg);
      }
    } else {
      onLogin(role.toLowerCase());
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 via-white to-green-50 p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <LogoIcon size={60} />
          </div>
          <h1 className="mb-2 text-3xl font-bold">Welcome Back</h1>
          <p className="text-gray-600">Sign in to manage your properties</p>
        </div>

        {/* Login Form */}
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
          {errorMessage && (
            <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Email Address</label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full rounded-lg border border-gray-300 py-3 pr-4 pl-10 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <Lock className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full rounded-lg border border-gray-300 py-3 pr-12 pl-10 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 transform text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Login (Dev Only) */}
          {process.env.NODE_ENV !== 'production' && (
            <>
              <div className="my-6 flex items-center">
                <div className="flex-1 border-t border-gray-300"></div>
                <span className="px-4 text-sm text-gray-500">or</span>
                <div className="flex-1 border-t border-gray-300"></div>
              </div>

              <div className="space-y-2">
                <p className="mb-3 text-xs text-gray-600">Quick demo access (Dev):</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDemoLogin('manager')}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    Manager
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemoLogin('landlord')}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    Landlord
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemoLogin('tenant')}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    Tenant
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemoLogin('vendor')}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    Vendor
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={onSwitchToRegister}
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                Sign up for free
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
