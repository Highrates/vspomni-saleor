import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { GiftCertificateSource, GiftCertificateStatus } from '@prisma/client';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { parseOptionalPositiveInt } from '../common/parse-positive-int';
import {
  AdjustGiftCertificateDto,
  CreateDenominationDto,
  ExtendGiftCertificateDto,
  GIFT_CERTIFICATE_STATUSES,
  IssueGiftCertificateDto,
  ReorderDenominationImagesDto,
  ReorderDenominationsDto,
  UpdateDenominationDto,
} from './dto/gift-certificate.dto';
import { GiftCertificatesAdminService } from './gift-certificates-admin.service';

function parseOptionalBool01(raw?: string): boolean | undefined {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return undefined;
}

function parseStatus(raw?: string): GiftCertificateStatus | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim().toUpperCase();
  if ((GIFT_CERTIFICATE_STATUSES as readonly string[]).includes(v)) {
    return v as GiftCertificateStatus;
  }
  return undefined;
}

function parseSource(raw?: string): GiftCertificateSource | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim().toUpperCase();
  if (v === 'ADMIN' || v === 'PURCHASE') return v as GiftCertificateSource;
  return undefined;
}

@Controller('gift-certificates/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class GiftCertificatesAdminController {
  constructor(private readonly gifts: GiftCertificatesAdminService) {}

  @Get('denominations')
  listDenominations(@Query('active') active?: string) {
    return this.gifts.listDenominations({ active: parseOptionalBool01(active) });
  }

  @Post('denominations')
  createDenomination(@Body() dto: CreateDenominationDto) {
    return this.gifts.createDenomination(dto);
  }

  @Post('denominations/reorder')
  reorderDenominations(@Body() dto: ReorderDenominationsDto) {
    return this.gifts.reorderDenominations(dto.orderedIds);
  }

  @Patch('denominations/:id')
  updateDenomination(@Param('id') id: string, @Body() dto: UpdateDenominationDto) {
    return this.gifts.updateDenomination(id, dto);
  }

  @Delete('denominations/:id')
  deleteDenomination(@Param('id') id: string) {
    return this.gifts.deleteDenomination(id);
  }

  @Post('denominations/:id/images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 80 * 1024 * 1024 },
    }),
  )
  uploadDenominationImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Файл не передан');
    return this.gifts.uploadDenominationImage(id, file);
  }

  @Patch('denominations/:id/images/reorder')
  reorderDenominationImages(
    @Param('id') id: string,
    @Body() dto: ReorderDenominationImagesDto,
  ) {
    return this.gifts.reorderDenominationImages(id, dto.imageIds);
  }

  @Delete('denomination-images/:id')
  deleteDenominationImage(@Param('id') id: string) {
    return this.gifts.deleteDenominationImage(id);
  }

  @Get()
  list(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('denominationId') denominationId?: string,
    @Query('source') source?: string,
  ) {
    return this.gifts.listCertificates({
      q,
      page: parseOptionalPositiveInt(page),
      limit: parseOptionalPositiveInt(limit),
      status: parseStatus(status),
      denominationId: denominationId?.trim() || undefined,
      source: parseSource(source),
    });
  }

  @Post('issue')
  issue(@CurrentUser('sub') actorUserId: string, @Body() dto: IssueGiftCertificateDto) {
    return this.gifts.issue(actorUserId, dto);
  }

  @Get(':id')
  one(
    @Param('id') id: string,
    @Query('ledgerPage') ledgerPage?: string,
    @Query('ledgerLimit') ledgerLimit?: string,
  ) {
    return this.gifts.getCertificate(id, {
      ledgerPage: parseOptionalPositiveInt(ledgerPage),
      ledgerLimit: parseOptionalPositiveInt(ledgerLimit),
    });
  }

  @Post(':id/revoke')
  revoke(
    @CurrentUser('sub') actorUserId: string,
    @Param('id') id: string,
    @Body() body?: { note?: string | null },
  ) {
    return this.gifts.revoke(actorUserId, id, body?.note);
  }

  @Post(':id/resend-email')
  resendEmail(@Param('id') id: string) {
    return this.gifts.resendEmail(id);
  }

  @Post(':id/adjust')
  adjust(
    @CurrentUser('sub') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: AdjustGiftCertificateDto,
  ) {
    return this.gifts.adjust(actorUserId, id, dto);
  }

  @Post(':id/extend')
  extend(@Param('id') id: string, @Body() dto: ExtendGiftCertificateDto) {
    return this.gifts.extend(id, dto);
  }
}
