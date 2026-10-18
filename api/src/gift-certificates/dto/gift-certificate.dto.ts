import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const GIFT_CERTIFICATE_STATUSES = [
  'ACTIVE',
  'USED_UP',
  'EXPIRED',
  'REVOKED',
] as const;
export type GiftCertificateStatusDto = (typeof GIFT_CERTIFICATE_STATUSES)[number];

export class CreateDenominationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  faceValue!: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  validityDays?: number | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  sortOrder?: number;
}

export class UpdateDenominationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  faceValue?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  validityDays?: number | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  sortOrder?: number;
}

export class ReorderDenominationImagesDto {
  @IsArray()
  @IsString({ each: true })
  imageIds!: string[];
}

export class ReorderDenominationsDto {
  @IsArray()
  @IsString({ each: true })
  orderedIds!: string[];
}

export class IssueGiftCertificateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  denominationId?: string;

  /** Если без denominationId — обязателен faceValue. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  faceValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  count?: number;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @IsISO8601()
  expiresAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @IsEmail()
  @MaxLength(320)
  recipientEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}

export class AdjustGiftCertificateDto {
  @Type(() => Number)
  @IsInt()
  /** Дельта баланса (₽): +пополнить / −списать. */
  delta!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class ExtendGiftCertificateDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && String(v).trim() !== '')
  @IsISO8601()
  expiresAt?: string | null;
}
