import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ReplaceFavoritesDto {
  @IsArray()
  @IsString({ each: true })
  variantIds!: string[];
}

export class UpsertBuyerAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  recipientName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  apartment?: string | null;

  /** Область / край */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string | null;

  /** Район города */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  district?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateBuyerProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  /** YYYY-MM-DD */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  birthday?: string | null;
}

export class ChangeBuyerPasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
