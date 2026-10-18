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

export class UpsertFaqItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  question!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  answer!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ReplaceFaqItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertFaqItemDto)
  items!: UpsertFaqItemDto[];
}
