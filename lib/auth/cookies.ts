import { cookies } from 'next/headers';

export async function setAuthCookies(
  accessToken: string,
  refreshToken: string,
  refreshMaxAgeSeconds: number = 7 * 24 * 60 * 60,
) {
  const cookieStore = await cookies();

  cookieStore.set('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60,
  });

  cookieStore.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth/refresh', // attached exclusively to this endpoint
    maxAge: refreshMaxAgeSeconds,
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();

  cookieStore.delete({ name: 'access_token', path: '/' });
  cookieStore.delete({ name: 'refresh_token', path: '/api/v1/auth/refresh' }); // path must match
}
