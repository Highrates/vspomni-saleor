import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UpsertStorySlideDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  url!: string;

  @IsOptional()
  @IsIn(['image', 'video'])
  mediaType?: 'image' | 'video';
}

export class UpsertStoryDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coverUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertStorySlideDto)
  slides?: UpsertStorySlideDto[];
}

export class ReplaceStoriesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertStoryDto)
  items!: UpsertStoryDto[];
}
