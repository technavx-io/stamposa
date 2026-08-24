import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Request } from 'express';
import { ActorRole, AuthActor } from '../auth.types';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as reachable without a bearer token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Restricts a route to the given actor roles (guard enforced). */
export const Roles = (...roles: ActorRole[]) => SetMetadata(ROLES_KEY, roles);

type RequestWithActor = Request & { actor?: AuthActor };

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthActor => {
    const req = ctx.switchToHttp().getRequest<RequestWithActor>();
    return req.actor as AuthActor;
  },
);

export const CurrentMerchant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<RequestWithActor>();
    if (req.actor?.role !== 'MERCHANT') return undefined;
    return req.actor.merchant;
  },
);

export const CurrentStaff = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<RequestWithActor>();
    if (req.actor?.role !== 'STAFF') return undefined;
    return req.actor.staff;
  },
);

export const CurrentCustomer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<RequestWithActor>();
    if (req.actor?.role !== 'CUSTOMER') return undefined;
    return req.actor.customer;
  },
);
