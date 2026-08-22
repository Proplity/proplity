'use client';

import { useRouter } from 'next/navigation';
import { ForgotPassword } from '../components/Auth/ForgotPassword';

export default function Page() {
  const router = useRouter();

  return <ForgotPassword onBack={() => router.push('/login')} />;
}
