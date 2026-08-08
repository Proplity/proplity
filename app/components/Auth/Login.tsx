import { useState } from 'react';
import { LogoIcon } from '../Logo';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

interface LoginProps {
  onLogin: (role: string) => void;
  onSwitchToRegister: () => void;
  onForgotPassword: () => void;
}

export function Login({ onLogin, onSwitchToRegister, onForgotPassword }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate login - in real app, validate credentials
    // Default to manager role for demo
    onLogin('manager');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 p-6">
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
                  placeholder="you@example.com"
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
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Remember me</span>
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
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Sign In
              <ArrowRight className="h-5 w-5" />
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-4 text-sm text-gray-500">or</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          {/* Quick Demo Login */}
          <div className="space-y-2">
            <p className="mb-3 text-xs text-gray-600">Quick demo access:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onLogin('manager')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
              >
                Manager
              </button>
              <button
                onClick={() => onLogin('landlord')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
              >
                Landlord
              </button>
              <button
                onClick={() => onLogin('tenant')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
              >
                Tenant
              </button>
              <button
                onClick={() => onLogin('vendor')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
              >
                Vendor
              </button>
            </div>
          </div>

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
