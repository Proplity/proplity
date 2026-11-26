import { NextRequest } from 'next/server';
import { handleLogin } from '@/lib/auth/loginFlow';

// Admins only; everyone else gets the same "Invalid email or password" as a wrong password.
export async function POST(req: NextRequest) {
  return handleLogin(req, 'admin');
}
