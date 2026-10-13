import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { notifyByEmail } from '@/lib/notifications';

type RouteCtx = { params: Promise<{ id: string }> };

// Admin controls over one account (ISS-054): suspend, reactivate, or move to a
// different role. A reason is required and every change is audit-logged.
//
// Guardrails: an admin cannot act on their own account or on another admin
// (admins are provisioned out of band), cannot verify an email by hand, and
// cannot change the role of someone who already has properties, a tenancy or
// maintenance jobs, because the records would no longer match their role.
const patchSchema = z
  .object({
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
    role: z.enum(['TENANT', 'LANDLORD', 'MANAGER', 'VENDOR']).optional(),
    reason: z.string().trim().min(3).max(500),
  })
  .refine((v) => v.status || v.role, { message: 'Provide a status or a role' });

export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const validated = await validateBody(req, patchSchema);
      if (!validated.success) return validated.response;
      const { status, role, reason } = validated.data;

      if (id === session.sub) {
        return NextResponse.json({ error: 'You cannot change your own account' }, { status: 403 });
      }
      const target = await prisma.user.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              managedProperties: true,
              ownedProperties: true,
              leases: true,
              maintenanceRequests: true,
              assignedJobs: true,
            },
          },
        },
      });
      if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      if (target.role === 'ADMIN') {
        return NextResponse.json(
          { error: 'Admin accounts cannot be changed here' },
          { status: 403 },
        );
      }

      if (status === 'ACTIVE' && target.status === 'PENDING_VERIFICATION') {
        return NextResponse.json(
          { error: 'This person has not verified their email yet' },
          { status: 409 },
        );
      }
      if (status === 'SUSPENDED' && target.status === 'PENDING_VERIFICATION') {
        return NextResponse.json(
          { error: 'This account is not active yet, so there is nothing to suspend' },
          { status: 409 },
        );
      }
      if (role && role !== target.role) {
        const c = target._count;
        const inUse =
          c.managedProperties + c.ownedProperties + c.leases + c.maintenanceRequests + c.assignedJobs;
        if (inUse > 0) {
          return NextResponse.json(
            {
              error:
                'This person already has properties, a tenancy or maintenance jobs, so their role cannot be changed',
            },
            { status: 409 },
          );
        }
      }

      const changes: Record<string, { from: string; to: string }> = {};
      const data: { status?: 'ACTIVE' | 'SUSPENDED'; role?: typeof role } = {};
      if (status && status !== target.status) {
        data.status = status;
        changes.status = { from: target.status, to: status };
      }
      if (role && role !== target.role) {
        data.role = role;
        changes.role = { from: target.role, to: role };
      }
      if (Object.keys(changes).length === 0) {
        return NextResponse.json({ error: 'Nothing to change' }, { status: 409 });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.user.update({
          where: { id },
          data,
          select: { id: true, name: true, email: true, role: true, status: true },
        });
        // A suspended or re-roled person must sign in again: end every session.
        if (data.status === 'SUSPENDED' || data.role) {
          await tx.refreshToken.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        const action = changes.role
          ? 'USER_ROLE_CHANGED'
          : data.status === 'SUSPENDED'
            ? 'USER_SUSPENDED'
            : 'USER_REACTIVATED';
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action,
            entityType: 'User',
            entityId: id,
            metadata: { changes, reason, email: target.email },
          },
        });
        return row;
      });

      if (changes.status) {
        const suspended = data.status === 'SUSPENDED';
        await notifyByEmail(
          target.email,
          suspended
            ? 'Your Proplity account was suspended'
            : 'Your Proplity account is active again',
          suspended
            ? `Hi ${target.name},\n\nYour Proplity account has been suspended. Reason: ${reason}\n\nIf you think this is a mistake, please contact support.`
            : `Hi ${target.name},\n\nYour Proplity account is active again. You can sign in as usual.`,
        );
      }

      return NextResponse.json({ data: updated });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
