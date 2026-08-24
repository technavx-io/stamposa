import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Request } from 'express';
import { PlatformAdmin } from '@prisma/client';
import { AdminCapability } from '../admin.types';

/** Marks a route as requiring a fully authenticated admin session. */
export const ADMIN_ROUTE_KEY = 'isAdminRoute';
export const AdminRoute = () => SetMetadata(ADMIN_ROUTE_KEY, true);

/** Restricts a route to admins whose role holds this capability. */
export const ADMIN_CAPABILITY_KEY = 'adminCapability';
export const RequireCapability = (capability: AdminCapability) =>
  SetMetadata(ADMIN_CAPABILITY_KEY, capability);

type RequestWithAdmin = Request & { admin?: PlatformAdmin };

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformAdmin =>
    ctx.switchToHttp().getRequest<RequestWithAdmin>().admin as PlatformAdmin,
);

/** Request metadata captured on every audited action. */
export const RequestContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return {
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    };
  },
);
