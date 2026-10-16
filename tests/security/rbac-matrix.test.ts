import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withAuth } from '@/lib/api/withAuth';
import { getServerSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { Role, UserStatus, type User } from '@prisma/client';

vi.mock('@/lib/auth/session', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

type AccountMock = User;

describe('Security Testing: RBAC & Authentication Middleware', () => {
  const dummyHandler = vi.fn().mockImplementation(async () => {
    return NextResponse.json({ ok: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const protectedEndpoint = withAuth(dummyHandler);
    const req = new NextRequest('http://localhost:3000/api/v1/properties');

    const res = await protectedEndpoint(req);
    expect(res.status).toBe(401);
    expect(dummyHandler).not.toHaveBeenCalled();
  });

  it('immediately blocks SUSPENDED accounts with 403 per ISS-054', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ sub: 'user-suspended', role: 'TENANT' });
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      status: UserStatus.SUSPENDED,
      role: Role.TENANT,
    } as unknown as AccountMock);

    const protectedEndpoint = withAuth(dummyHandler);
    const req = new NextRequest('http://localhost:3000/api/v1/applications');

    const res = await protectedEndpoint(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Account is suspended');
    expect(dummyHandler).not.toHaveBeenCalled();
  });

  it('blocks users lacking the required role with 403 Forbidden', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ sub: 'user-tenant', role: 'TENANT' });
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      status: UserStatus.ACTIVE,
      role: Role.TENANT,
    } as unknown as AccountMock);

    // Endpoint restricted to ADMIN and LANDLORD
    const adminEndpoint = withAuth(dummyHandler, { roles: [Role.ADMIN, Role.LANDLORD] });
    const req = new NextRequest('http://localhost:3000/api/v1/admin/audit-logs');

    const res = await adminEndpoint(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
    expect(dummyHandler).not.toHaveBeenCalled();
  });

  it('refreshes role from DB to prevent privilege escalation via stale JWT', async () => {
    // JWT claims role is ADMIN, but database record shows user was demoted to TENANT
    vi.mocked(getServerSession).mockResolvedValueOnce({ sub: 'user-demoted', role: 'ADMIN' });
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      status: UserStatus.ACTIVE,
      role: Role.TENANT, // DB reflects truth
    } as unknown as AccountMock);

    const adminEndpoint = withAuth(dummyHandler, { roles: [Role.ADMIN] });
    const req = new NextRequest('http://localhost:3000/api/v1/admin/users');

    const res = await adminEndpoint(req);
    expect(res.status).toBe(403);
    expect(dummyHandler).not.toHaveBeenCalled();
  });

  it('allows authorized users through to handler', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ sub: 'user-admin', role: 'ADMIN' });
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      status: UserStatus.ACTIVE,
      role: Role.ADMIN,
    } as unknown as AccountMock);

    const adminEndpoint = withAuth(dummyHandler, { roles: [Role.ADMIN] });
    const req = new NextRequest('http://localhost:3000/api/v1/admin/audit-logs');

    const res = await adminEndpoint(req);
    expect(res.status).toBe(200);
    expect(dummyHandler).toHaveBeenCalled();
  });
});
