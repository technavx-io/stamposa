import { Injectable } from '@nestjs/common';
import { Prisma, StaffRole } from '@prisma/client';
import { EntitlementsService } from '../billing/entitlements.service';
import { conflict, forbidden, notFound } from '../common/exceptions';
import { PasswordService } from '../common/password.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto, StaffDto, toStaffDto, UpdateStaffDto } from './dto/staff.dto';

@Injectable()
export class StaffManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * Refuses to add or promote a MANAGER when the business is already at its
   * plan-tier cap. Only ACTIVE managers count — deactivating one frees the
   * slot. Bug #6.
   */
  private async assertManagerCapacity(businessId: string): Promise<void> {
    const { limits, tier } = await this.entitlements.forBusiness(businessId);
    if (limits.maxManagers === null) return; // unlimited (PRO)
    const activeManagers = await this.prisma.staff.count({
      where: { businessId, role: StaffRole.MANAGER, isActive: true },
    });
    if (activeManagers >= limits.maxManagers) {
      throw forbidden(
        'MANAGER_LIMIT_REACHED',
        limits.maxManagers === 0
          ? `The ${tier} plan does not include manager accounts — upgrade to promote staff.`
          : `You are at your plan's manager limit (${limits.maxManagers}). Upgrade or deactivate an existing manager first.`,
      );
    }
  }

  async create(businessId: string, dto: CreateStaffDto): Promise<StaffDto> {
    if (dto.role === StaffRole.MANAGER) {
      await this.assertManagerCapacity(businessId);
    }
    const passwordHash = await this.passwords.hash(dto.password);
    try {
      const staff = await this.prisma.staff.create({
        data: { businessId, name: dto.name, email: dto.email, passwordHash, role: dto.role },
        include: { _count: { select: { stampsIssued: true } } },
      });
      return toStaffDto(staff);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw conflict(
          'STAFF_EMAIL_EXISTS',
          'This email is already registered as staff.',
        );
      }
      throw e;
    }
  }

  async list(businessId: string): Promise<StaffDto[]> {
    const staff = await this.prisma.staff.findMany({
      where: { businessId },
      include: { _count: { select: { stampsIssued: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return staff.map(toStaffDto);
  }

  async update(businessId: string, staffId: string, dto: UpdateStaffDto): Promise<StaffDto> {
    const existing = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
    });
    if (!existing) throw notFound('STAFF_NOT_FOUND', 'Staff member not found.');

    // Manager cap: fire only when a real promotion is happening — either the
    // role is changing to MANAGER, or a currently-inactive manager is being
    // reactivated. Demotion / deactivation always allowed.
    const becomingManager =
      (dto.role === StaffRole.MANAGER && existing.role !== StaffRole.MANAGER) ||
      (dto.isActive === true && !existing.isActive && existing.role === StaffRole.MANAGER);
    if (becomingManager) {
      await this.assertManagerCapacity(businessId);
    }

    const passwordHash = dto.password ? await this.passwords.hash(dto.password) : undefined;

    const staff = await this.prisma.staff.update({
      where: { id: staffId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(passwordHash !== undefined ? { passwordHash } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
      },
      include: { _count: { select: { stampsIssued: true } } },
    });
    return toStaffDto(staff);
  }
}
