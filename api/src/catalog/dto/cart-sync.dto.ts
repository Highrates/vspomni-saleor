import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CartSyncLineDto {
  @IsString()
  @MinLength(1)
  variantId!: string;

  @IsOptional()
  @IsString()
  shadeId?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  qty!: number;
}

export class SyncCartDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CartSyncLineDto)
  lines!: CartSyncLineDto[];
}
