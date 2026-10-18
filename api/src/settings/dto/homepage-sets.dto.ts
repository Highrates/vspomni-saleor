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

export class UpsertHomepageSetDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  imageUrl!: string;

  @IsString()
  @MinLength(1)
  productId!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ReplaceHomepageSetsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertHomepageSetDto)
  items!: UpsertHomepageSetDto[];
}
