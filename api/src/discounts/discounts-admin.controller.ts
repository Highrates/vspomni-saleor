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
import { DiscountScope } from '@prisma/client';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { parseOptionalPositiveInt } from '../common/parse-positive-int';
import { CreateDiscountDto, UpdateDiscountDto } from './dto/discounts-admin.dto';
import { DiscountsAdminService } from './discounts-admin.service';

function parseOptionalBool01(raw?: string): boolean | undefined {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return undefined;
}

function parseOptionalScope(raw?: string): DiscountScope | undefined {
  if (raw === DiscountScope.CATEGORY || raw === DiscountScope.PRODUCTS) return raw;
  return undefined;
}

@Controller('discounts/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class DiscountsAdminController {
  constructor(private readonly discounts: DiscountsAdminService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('active') active?: string,
    @Query('scope') scope?: string,
    @Query('live') live?: string,
  ) {
    return this.discounts.list({
      q,
      page: parseOptionalPositiveInt(page),
      limit: parseOptionalPositiveInt(limit),
      active: parseOptionalBool01(active),
      scope: parseOptionalScope(scope),
      live: parseOptionalBool01(live) === true ? true : undefined,
    });
  }

  @Post()
  create(@Body() dto: CreateDiscountDto) {
    return this.discounts.create(dto);
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.discounts.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDiscountDto) {
    return this.discounts.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.discounts.delete(id);
  }
}
