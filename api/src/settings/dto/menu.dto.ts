import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateMenuSettingsDto {
  /** null / "" — сбросить товар */
  @ValidateIf((_, v) => v != null && v !== '')
  @IsString()
  @MaxLength(64)
  productId?: string | null;

  @IsOptional()
  @Type(() => String)
  @IsString()
  @MaxLength(2000)
  annotationText?: string;
}
