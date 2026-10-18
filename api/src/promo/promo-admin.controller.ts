import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { parseOptionalPositiveInt } from '../common/parse-positive-int';
import { CreatePromoCodeDto, UpdatePromoCodeDto } from './dto/promo.dto';
import { PromoAdminService } from './promo.service';

function parseOptionalBool01(raw?: string): boolean | undefined {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return undefined;
}

@Controller('promo/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PromoAdminController {
  constructor(private readonly promo: PromoAdminService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('active') active?: string,
  ) {
    return this.promo.list({
      q,
      page: parseOptionalPositiveInt(page),
      limit: parseOptionalPositiveInt(limit),
      active: parseOptionalBool01(active),
    });
  }

  @Post()
  create(@Body() dto: CreatePromoCodeDto) {
    return this.promo.create(dto);
  }

  @Get(':id')
  one(
    @Param('id') id: string,
    @Query('redemptionsPage') redemptionsPage?: string,
    @Query('redemptionsLimit') redemptionsLimit?: string,
  ) {
    return this.promo.get(id, {
      redemptionsPage: parseOptionalPositiveInt(redemptionsPage),
      redemptionsLimit: parseOptionalPositiveInt(redemptionsLimit),
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePromoCodeDto) {
    return this.promo.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.promo.delete(id);
  }
}
