'use client';

import { useRouter } from 'next/navigation';
import { Login } from '../components/Auth/Login';

export default function Page() {
  const router = useRouter();

  return (
    <Login
      onLogin={(role) => router.push(role === 'admin' ? '/admin' : '/dashboard')}
      onSwitchToRegister={() => router.push('/register')}
      onForgotPassword={() => router.push('/forgot-password')}
    />
  );
}
