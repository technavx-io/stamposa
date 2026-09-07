import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Business, Merchant } from '@prisma/client';
import { CurrentMerchant, Roles } from '../auth/decorators/auth.decorators';
import { requireBusiness } from '../businesses/business.util';
import { CreateStaffDto, StaffDto, UpdateStaffDto } from './dto/staff.dto';
import { StaffManagementService } from './staff-management.service';

type MerchantWithBusiness = Merchant & { business: Business | null };

@ApiTags('Merchant · Staff')
@ApiBearerAuth()
@Roles('MERCHANT')
@Controller('merchant/staff')
export class StaffManagementController {
  constructor(private readonly staffService: StaffManagementService) {}

  @Post()
  @ApiOperation({ summary: 'Add a staff member (they log in with this phone + OTP)' })
  @ApiOkResponse({ type: StaffDto })
  create(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Body() dto: CreateStaffDto,
  ): Promise<StaffDto> {
    return this.staffService.create(requireBusiness(merchant.business).id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List staff members' })
  @ApiOkResponse({ type: StaffDto, isArray: true })
  list(@CurrentMerchant() merchant: MerchantWithBusiness): Promise<StaffDto[]> {
    return this.staffService.list(requireBusiness(merchant.business).id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename or activate/deactivate a staff member' })
  @ApiOkResponse({ type: StaffDto })
  update(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ): Promise<StaffDto> {
    return this.staffService.update(requireBusiness(merchant.business).id, id, dto);
  }
}
