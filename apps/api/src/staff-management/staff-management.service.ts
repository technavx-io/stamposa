import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { conflict, notFound } from '../common/exceptions';
import { PasswordService } from '../common/password.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto, StaffDto, toStaffDto, UpdateStaffDto } from './dto/staff.dto';

@Injectable()
export class StaffManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async create(businessId: string, dto: CreateStaffDto): Promise<StaffDto> {
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
