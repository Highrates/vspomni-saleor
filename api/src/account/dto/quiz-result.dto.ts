import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class QuizResultMetaDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  priority?: number | null;

  @IsArray()
  @IsString({ each: true })
  blockKeys!: string[];
}

export class UpsertQuizResultDto {
  @IsInt()
  @Min(1)
  @Max(1)
  version!: number;

  @IsIn(['face'])
  zone!: 'face';

  /** ISO datetime */
  @IsString()
  completedAt!: string;

  @IsObject()
  answers!: Record<string, unknown>;

  @ValidateNested()
  @Type(() => QuizResultMetaDto)
  result!: QuizResultMetaDto;
}
