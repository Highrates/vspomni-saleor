import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class UpsertQuizContentEntryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  plain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  html?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mediaUrl?: string | null;

  @IsOptional()
  @IsIn(['image', 'video'])
  mediaType?: 'image' | 'video' | null;
}

export class ReplaceQuizContentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertQuizContentEntryDto)
  items!: UpsertQuizContentEntryDto[];
}
