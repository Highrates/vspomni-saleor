import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DashboardAdminService } from './dashboard-admin.service';

@Controller('dashboard/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class DashboardAdminController {
  constructor(private readonly dashboard: DashboardAdminService) {}

  @Get('overview')
  overview(
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboard.getOverview({ period, from, to });
  }
}
