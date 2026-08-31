import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Business, Merchant } from '@prisma/client';
import { badRequest } from '../common/exceptions';
import { PhoneService } from '../common/phone.service';
import { CurrentMerchant } from '../auth/decorators/auth.decorators';
import { Roles } from '../auth/decorators/auth.decorators';
import { requireBusiness } from './business.util';
import { BusinessesService } from './businesses.service';
import { BusinessDto } from './dto/business.dto';
import { CreateBusinessDto, QrQueryDto, UpdateBusinessDto } from './dto/business-request.dto';

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const CARD_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

class QrResponseDto {
  @ApiProperty({ example: 'http://localhost:3000/join/brew-and-bean' })
  joinUrl: string;

  @ApiProperty({ description: 'PNG data URL' })
  qrDataUrl: string;
}

type MerchantWithBusiness = Merchant & { business: Business | null };

@ApiTags('Merchant · Business')
@ApiBearerAuth()
@Roles('MERCHANT')
@Controller('merchant/business')
export class BusinessesController {
  constructor(
    private readonly businesses: BusinessesService,
    private readonly phones: PhoneService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create the business profile (one per merchant in Phase 1)' })
  @ApiOkResponse({ type: BusinessDto })
  create(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Body() dto: CreateBusinessDto,
  ): Promise<BusinessDto> {
    return this.businesses.create(merchant.id, this.normalisePhone(dto));
  }

  @Get()
  @ApiOperation({ summary: 'Get the business profile' })
  @ApiOkResponse({ type: BusinessDto })
  get(@CurrentMerchant() merchant: MerchantWithBusiness): BusinessDto {
    return this.businesses.dto(requireBusiness(merchant.business));
  }

  @Patch()
  @ApiOperation({ summary: 'Update the business profile' })
  @ApiOkResponse({ type: BusinessDto })
  update(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Body() dto: UpdateBusinessDto,
  ): Promise<BusinessDto> {
    const business = requireBusiness(merchant.business);
    return this.businesses.update(business.id, this.normalisePhone(dto));
  }

  @Post('logo')
  @ApiOperation({ summary: 'Upload/replace the business logo (PNG/JPEG/WebP, max 2 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: BusinessDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LOGO_MAX_BYTES } }))
  uploadLogo(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<BusinessDto> {
    const business = requireBusiness(merchant.business);
    if (!file) throw badRequest('FILE_REQUIRED', 'Attach an image file named "file".');
    return this.businesses.setLogo(business, file);
  }

  @Delete('logo')
  @ApiOperation({ summary: 'Remove the business logo' })
  @ApiOkResponse({ type: BusinessDto })
  removeLogo(@CurrentMerchant() merchant: MerchantWithBusiness): Promise<BusinessDto> {
    return this.businesses.removeLogo(requireBusiness(merchant.business));
  }

  @Post('card-image')
  @ApiOperation({ summary: 'Upload/replace the default card background image (max 4 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: BusinessDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: CARD_IMAGE_MAX_BYTES } }))
  uploadCardImage(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<BusinessDto> {
    const business = requireBusiness(merchant.business);
    if (!file) throw badRequest('FILE_REQUIRED', 'Attach an image file named "file".');
    return this.businesses.setCardImage(business, file);
  }

  @Delete('card-image')
  @ApiOperation({ summary: 'Remove the default card background image' })
  @ApiOkResponse({ type: BusinessDto })
  removeCardImage(@CurrentMerchant() merchant: MerchantWithBusiness): Promise<BusinessDto> {
    return this.businesses.removeCardImage(requireBusiness(merchant.business));
  }

  @Get('qr')
  @ApiOperation({ summary: 'QR code (data URL) linking to the customer join page' })
  @ApiOkResponse({ type: QrResponseDto })
  qr(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Query() query: QrQueryDto,
  ): Promise<QrResponseDto> {
    const business = requireBusiness(merchant.business);
    return this.businesses.qrForBusiness(business, this.parseSize(query.size, 512));
  }

  @Get('qr.png')
  @Header('Content-Type', 'image/png')
  @ApiOperation({ summary: 'Downloadable QR code PNG' })
  async qrPng(
    @CurrentMerchant() merchant: MerchantWithBusiness,
    @Query() query: QrQueryDto,
  ): Promise<StreamableFile> {
    const business = requireBusiness(merchant.business);
    const png = await this.businesses.qrPng(business, this.parseSize(query.size, 1024));
    return new StreamableFile(png, {
      disposition: `attachment; filename="join-qr-${business.slug}.png"`,
    });
  }

  /** Business phone is display data but still normalised when parseable. */
  private normalisePhone<T extends { phone?: string }>(dto: T): T {
    if (dto.phone) {
      dto.phone = this.phones.normalize(dto.phone);
    }
    return dto;
  }

  private parseSize(raw: string | undefined, fallback: number): number {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }
}
