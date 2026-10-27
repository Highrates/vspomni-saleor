import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class UpsertUnpackingReelDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  videoUrl!: string;

  /** Постер обязателен для LCP на главной. */
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  posterUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  captionName?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsDateString()
  captionDate?: string | null;

  @IsString()
  @MinLength(1)
  productId!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ReplaceUnpackingReelsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertUnpackingReelDto)
  items!: UpsertUnpackingReelDto[];
}
