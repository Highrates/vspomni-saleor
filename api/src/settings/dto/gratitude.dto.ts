import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class GratitudeGiftRuleInputDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  minRub!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  maxRub?: number | null;

  @IsString()
  @MinLength(1)
  variantId!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class GratitudeGiftTierInputDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  infoHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ReplaceGratitudeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  articleSlug?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GratitudeGiftRuleInputDto)
  rules!: GratitudeGiftRuleInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GratitudeGiftTierInputDto)
  tiers?: GratitudeGiftTierInputDto[];
}
