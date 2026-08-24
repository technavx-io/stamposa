import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { forbidden, unauthorized } from '../../common/exceptions';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { ADMIN_ROUTE_KEY } from '../../admin/decorators/admin.decorators';
import { AuthActor, JwtPayload } from '../auth.types';

/**
 * Global guard (secure by default): every route requires a valid access token
 * unless explicitly marked @Public(). The actor is re-loaded from the
 * database on each request, so deactivated staff or deleted accounts lose
 * access the moment their record changes — no waiting for token expiry.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Admin routes carry a separate credential family (different secret,
    // different table) and are handled by AdminAuthGuard.
    const isAdminRoute = this.reflector.getAllAndOverride<boolean>(ADMIN_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isAdminRoute) return true;

    const req = context.switchToHttp().getRequest<Request & { actor?: AuthActor }>();
    const token = this.extractBearer(req);
    if (!token) {
      throw unauthorized('MISSING_TOKEN', 'Sign in to continue.');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.jwtAccessSecret,
      });
    } catch {
      throw unauthorized('INVALID_TOKEN', 'Your session has expired. Sign in again.');
    }
    if (payload.type !== 'access') {
      throw unauthorized('INVALID_TOKEN', 'Invalid token type.');
    }

    req.actor = await this.resolveActor(payload);

    // Impersonated merchant tokens are only honoured while the support
    // session is still open — ending it (or expiry) locks the admin out
    // mid-flight, not at the next token refresh.
    if (payload.imp && req.actor.role === 'MERCHANT') {
      const live = await this.prisma.impersonationSession.findFirst({
        where: {
          id: payload.imp.sessionId,
          endedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (!live) {
        throw unauthorized('IMPERSONATION_ENDED', 'This support session has ended.');
      }
      req.actor.impersonation = payload.imp;
    }
    return true;
  }

  private extractBearer(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }

  private async resolveActor(payload: JwtPayload): Promise<AuthActor> {
    switch (payload.role) {
      case 'MERCHANT': {
        const merchant = await this.prisma.merchant.findUnique({
          where: { id: payload.sub },
          include: { business: true },
        });
        if (!merchant) throw unauthorized('ACCOUNT_NOT_FOUND', 'Account no longer exists.');
        // A platform suspension locks the tenant out immediately, mid-session.
        if (merchant.business?.suspendedAt) {
          throw forbidden(
            'BUSINESS_SUSPENDED',
            merchant.business.suspendedReason
              ? `This account is suspended: ${merchant.business.suspendedReason}`
              : 'This account has been suspended. Contact support.',
          );
        }
        return { role: 'MERCHANT', merchant };
      }
      case 'STAFF': {
        const staff = await this.prisma.staff.findUnique({
          where: { id: payload.sub },
          include: { business: true },
        });
        if (!staff) throw unauthorized('ACCOUNT_NOT_FOUND', 'Account no longer exists.');
        if (!staff.isActive) {
          throw unauthorized('STAFF_INACTIVE', 'This staff account has been deactivated.');
        }
        if (staff.business.suspendedAt) {
          throw forbidden(
            'BUSINESS_SUSPENDED',
            'This business account is suspended. Ask the owner to contact support.',
          );
        }
        return { role: 'STAFF', staff };
      }
      case 'CUSTOMER': {
        const customer = await this.prisma.customer.findUnique({
          where: { id: payload.sub },
        });
        if (!customer) throw unauthorized('ACCOUNT_NOT_FOUND', 'Account no longer exists.');
        return { role: 'CUSTOMER', customer };
      }
      default:
        throw unauthorized('INVALID_TOKEN', 'Unknown actor role.');
    }
  }
}
