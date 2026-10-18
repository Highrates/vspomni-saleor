import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DiscountRewardType, DiscountScope } from '@prisma/client';
import {
  DISCOUNT_CONDITION_KINDS,
  type DiscountConditionKind,
} from '../discount-conditions.util';

export { DISCOUNT_CONDITION_KINDS };
export type DiscountConditionKindDto = DiscountConditionKind;

export class DiscountConditionItemDto {
  @IsIn([...DISCOUNT_CONDITION_KINDS])
  kind!: DiscountConditionKindDto;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  value!: number;
}

export class DiscountConditionsDto {
  @IsIn(['AND', 'OR'])
  logic!: 'AND' | 'OR';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscountConditionItemDto)
  items!: DiscountConditionItemDto[];
}

export class DiscountRuleInputDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DiscountConditionsDto)
  conditions?: DiscountConditionsDto | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsEnum(DiscountRewardType)
  rewardType!: DiscountRewardType;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  rewardValue!: number;
}

export class CreateDiscountDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsEnum(DiscountScope)
  scope!: DiscountScope;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscountRuleInputDto)
  rules?: DiscountRuleInputDto[];
}

export class UpdateDiscountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(DiscountScope)
  scope?: DiscountScope;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscountRuleInputDto)
  rules?: DiscountRuleInputDto[];
}

export {
  assertRewardValue,
  normalizeConditions,
} from '../discount-conditions.util';
