import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UpsertHeroSlideDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  imageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mobileImageUrl?: string | null;

  /** Куда ведёт клик по большому баннеру (`/catalog` или https://…) */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  href?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ReplaceHeroSlidesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertHeroSlideDto)
  items!: UpsertHeroSlideDto[];
}

export class UpdateHeroSecondaryBannerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  subtitle!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  imageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  href?: string | null;
}
