import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class PurchaseGiftCertificateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  denominationId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  qty!: number;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(40)
  @Matches(/^\+?[\d\s()\-]{10,40}$/, {
    message: 'Некорректный телефон',
  })
  phone!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  customerName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  guestId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotencyKey!: string;

  /** Кому отправить код (если не указан — email покупателя). */
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  recipientEmail?: string | null;
}
