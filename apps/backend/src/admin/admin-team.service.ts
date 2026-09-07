import { Injectable } from '@nestjs/common';
import { AdminRole, AuditActorType, PlatformAdmin, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { badRequest, conflict, forbidden, notFound } from '../common/exceptions';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthService, RequestMeta } from './admin-auth.service';
import { AdminTokenService } from './admin-token.service';

@Injectable()
export class AdminTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tokens: AdminTokenService,
  ) {}

  async list() {
    const admins = await this.prisma.platformAdmin.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    return Promise.all(
      admins.map(async (a) => ({
        id: a.id,
        email: a.email,
        name: a.name,
        role: a.role,
        isActive: a.isActive,
        twoFactorEnabled: a.totpEnabledAt !== null,
        activeSessions: await this.tokens.activeSessionCount(a.id),
        lastLoginAt: a.lastLoginAt,
        createdAt: a.createdAt,
      })),
    );
  }

  /**
   * Creates a colleague with a generated temporary password, returned once.
   * They set up their own authenticator on first sign-in.
   */
  async create(
    actor: PlatformAdmin,
    input: { email: string; name: string; role: AdminRole },
    meta: RequestMeta,
  ) {
    const email = input.email.trim().toLowerCase();
    const temporaryPassword = `${randomBytes(9).toString('base64url')}`;

    try {
      const created = await this.prisma.platformAdmin.create({
        data: {
          email,
          name: input.name.trim(),
          role: input.role,
          passwordHash: await AdminAuthService.hashPassword(temporaryPassword),
        },
      });
      await this.audit.record({
        actorType: AuditActorType.ADMIN,
        adminId: actor.id,
        actorLabel: actor.email,
        action: 'admin.team.created',
        targetType: 'platform_admin',
        targetId: created.id,
        targetLabel: created.email,
        metadata: { role: input.role },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      return {
        admin: {
          id: created.id,
          email: created.email,
          name: created.name,
          role: created.role,
          isActive: created.isActive,
          twoFactorEnabled: false,
          activeSessions: 0,
          lastLoginAt: null,
          createdAt: created.createdAt,
        },
        temporaryPassword,
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw conflict('ADMIN_EXISTS', 'An admin with that email already exists.');
      }
      throw e;
    }
  }

  async update(
    actor: PlatformAdmin,
    targetId: string,
    input: { name?: string; role?: AdminRole; isActive?: boolean },
    meta: RequestMeta,
  ) {
    const target = await this.prisma.platformAdmin.findUnique({ where: { id: targetId } });
    if (!target) throw notFound('ADMIN_NOT_FOUND', 'Admin not found.');

    if (target.id === actor.id && input.isActive === false) {
      throw badRequest('CANNOT_DEACTIVATE_SELF', 'You cannot deactivate your own account.');
    }
    if (target.id === actor.id && input.role && input.role !== actor.role) {
      throw badRequest('CANNOT_CHANGE_OWN_ROLE', 'You cannot change your own role.');
    }
    // Never allow the platform to end up with no super admin.
    if (
      target.role === AdminRole.SUPER_ADMIN &&
      (input.isActive === false || (input.role && input.role !== AdminRole.SUPER_ADMIN))
    ) {
      const remaining = await this.prisma.platformAdmin.count({
        where: { role: AdminRole.SUPER_ADMIN, isActive: true, id: { not: target.id } },
      });
      if (remaining === 0) {
        throw forbidden(
          'LAST_SUPER_ADMIN',
          'This is the last active super admin. Promote someone else first.',
        );
      }
    }

    const updated = await this.prisma.platformAdmin.update({
      where: { id: targetId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    // Deactivation must take effect now, not at token expiry.
    if (input.isActive === false) {
      await this.tokens.revokeAllForAdmin(targetId);
    }

    await this.audit.record({
      actorType: AuditActorType.ADMIN,
      adminId: actor.id,
      actorLabel: actor.email,
      action: input.isActive === false ? 'admin.team.deactivated' : 'admin.team.updated',
      targetType: 'platform_admin',
      targetId: updated.id,
      targetLabel: updated.email,
      metadata: input as Prisma.InputJsonValue,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      isActive: updated.isActive,
      twoFactorEnabled: updated.totpEnabledAt !== null,
      activeSessions: await this.tokens.activeSessionCount(updated.id),
      lastLoginAt: updated.lastLoginAt,
      createdAt: updated.createdAt,
    };
  }

  /** Signs an admin out of every device — used when a laptop goes missing. */
  async revokeSessions(actor: PlatformAdmin, targetId: string, meta: RequestMeta) {
    const target = await this.prisma.platformAdmin.findUnique({ where: { id: targetId } });
    if (!target) throw notFound('ADMIN_NOT_FOUND', 'Admin not found.');

    await this.tokens.revokeAllForAdmin(targetId);
    await this.audit.record({
      actorType: AuditActorType.ADMIN,
      adminId: actor.id,
      actorLabel: actor.email,
      action: 'admin.team.sessions_revoked',
      targetType: 'platform_admin',
      targetId: target.id,
      targetLabel: target.email,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { revoked: true };
  }
}
