import { Injectable } from '@nestjs/common';
import { Business } from '@prisma/client';
import { formatCode } from '../common/utils/codes.util';
import { PrismaService } from '../prisma/prisma.service';
import { issuerLabel } from './transactions.service';

const MAX_ROWS = 50_000;

/**
 * CSV exports, available on every plan by design — a merchant's customer
 * list is their asset, not a retention lever. Generated in-process; move to
 * a queued job with a signed URL when tenants outgrow one request.
 */
@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async customersCsv(business: Business): Promise<string> {
    const rows = await this.prisma.customerMembership.findMany({
      where: { businessId: business.id },
      include: { customer: true, campaign: { select: { name: true, stampsRequired: true } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
    });

    return toCsv(
      [
        'customer_code',
        'name',
        'phone',
        'email',
        'programme',
        'stamps_on_card',
        'stamps_required',
        'rewards_earned',
        'lifetime_stamps',
        'tags',
        'notes',
        'blocked',
        'last_stamp_at',
        'joined_at',
      ],
      rows.map((m) => [
        formatCode(m.code),
        m.customer.name ?? '',
        m.customer.phone ?? '',
        m.customer.email ?? '',
        m.campaign.name,
        m.stampCount,
        m.campaign.stampsRequired,
        m.completedCount,
        m.totalStamps,
        m.tags.join(' | '),
        m.notes ?? '',
        m.blockedAt ? 'yes' : 'no',
        m.lastStampAt?.toISOString() ?? '',
        m.createdAt.toISOString(),
      ]),
    );
  }

  async transactionsCsv(business: Business): Promise<string> {
    const rows = await this.prisma.stamp.findMany({
      where: { businessId: business.id },
      include: {
        staff: { select: { name: true } },
        membership: { include: { customer: { select: { name: true, phone: true, email: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
    });

    return toCsv(
      [
        'timestamp',
        'customer_code',
        'customer_name',
        'customer_phone',
        'customer_email',
        'change',
        'type',
        'issued_by',
        'completed_card',
        'reason',
      ],
      rows.map((s) => [
        s.createdAt.toISOString(),
        formatCode(s.membership.code),
        s.membership.customer.name ?? '',
        s.membership.customer.phone ?? '',
        s.membership.customer.email ?? '',
        s.delta,
        s.issuerType.toLowerCase(),
        issuerLabel(s.issuerType, s.staff?.name),
        s.completedCard ? 'yes' : 'no',
        s.reason ?? '',
      ]),
    );
  }

  async rewardsCsv(business: Business): Promise<string> {
    const rows = await this.prisma.redemption.findMany({
      where: { businessId: business.id },
      include: {
        redeemedStaff: { select: { name: true } },
        membership: { include: { customer: { select: { name: true, phone: true, email: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
    });

    return toCsv(
      ['voucher_code', 'reward', 'customer_name', 'customer_phone', 'customer_email', 'status', 'earned_at', 'redeemed_at', 'redeemed_by'],
      rows.map((r) => [
        formatCode(r.code),
        r.rewardText,
        r.membership.customer.name ?? '',
        r.membership.customer.phone ?? '',
        r.membership.customer.email ?? '',
        r.status.toLowerCase(),
        r.createdAt.toISOString(),
        r.redeemedAt?.toISOString() ?? '',
        r.status === 'REDEEMED'
          ? r.redeemedByType === 'MERCHANT'
            ? 'Owner'
            : (r.redeemedStaff?.name ?? 'Staff')
          : '',
      ]),
    );
  }
}

/** RFC 4180 quoting, with a BOM so Excel opens UTF-8 correctly. */
function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (value: string | number): string => {
    const s = String(value ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(','), ...rows.map((r) => r.map(escape).join(','))];
  // \uFEFF is the byte-order mark; Excel needs it to read UTF-8 correctly.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
