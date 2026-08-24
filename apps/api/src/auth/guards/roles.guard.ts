import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { forbidden } from '../../common/exceptions';
import { ActorRole, AuthActor } from '../auth.types';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators/auth.decorators';
import { ADMIN_ROUTE_KEY } from '../../admin/decorators/admin.decorators';

/** Runs after JwtAuthGuard; enforces @Roles(...) restrictions. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Admin routes use their own capability model, not tenant actor roles.
    const isAdminRoute = this.reflector.getAllAndOverride<boolean>(ADMIN_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isAdminRoute) return true;

    const required = this.reflector.getAllAndOverride<ActorRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request & { actor?: AuthActor }>();
    const role = req.actor?.role;
    if (!role || !required.includes(role)) {
      throw forbidden('WRONG_ROLE', 'You do not have access to this resource.');
    }
    return true;
  }
}
