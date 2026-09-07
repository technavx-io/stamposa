import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformAdmin } from '@prisma/client';
import { Request } from 'express';
import { forbidden, unauthorized } from '../../common/exceptions';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminTokenService } from '../admin-token.service';
import { AdminCapability, roleHasCapability } from '../admin.types';
import { ADMIN_CAPABILITY_KEY, ADMIN_ROUTE_KEY } from '../decorators/admin.decorators';

/**
 * Guards every @AdminRoute(). Runs before the tenant JwtAuthGuard would and
 * short-circuits it, because admin tokens are a separate credential family
 * signed with a different secret — a tenant token can never satisfy this.
 *
 * The admin record is re-read per request so deactivation takes effect
 * immediately rather than at token expiry.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AdminTokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAdminRoute = this.reflector.getAllAndOverride<boolean>(ADMIN_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isAdminRoute) return true;

    const req = context.switchToHttp().getRequest<Request & { admin?: PlatformAdmin }>();
    const header = req.headers.authorization;
    const [scheme, token] = header?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw unauthorized('MISSING_TOKEN', 'Sign in to continue.');
    }

    const payload = await this.tokens.verifyAccessToken(token);
    const admin = await this.prisma.platformAdmin.findUnique({ where: { id: payload.sub } });
    if (!admin) throw unauthorized('ACCOUNT_NOT_FOUND', 'Account no longer exists.');
    if (!admin.isActive) {
      throw forbidden('ADMIN_DEACTIVATED', 'This account has been deactivated.');
    }

    const capability = this.reflector.getAllAndOverride<AdminCapability | undefined>(
      ADMIN_CAPABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (capability && !roleHasCapability(admin.role, capability)) {
      throw forbidden(
        'INSUFFICIENT_ROLE',
        `Your role (${admin.role.replace('_', ' ').toLowerCase()}) cannot perform this action.`,
      );
    }

    req.admin = admin;
    return true;
  }
}
