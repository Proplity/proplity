import { NextRequest } from 'next/server';
import { handleLogin } from '@/lib/auth/loginFlow';

// Everyone except admins; an admin signs in at /admin/login (POST /api/v1/auth/admin/login).
export async function POST(req: NextRequest) {
  return handleLogin(req, 'general');
}
