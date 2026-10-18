import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateSiteSeoSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  siteUrl?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  titleSuffix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  defaultMetaDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  defaultOgImageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  homeMetaTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  homeMetaDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  homeOgImageUrl?: string | null;
}
