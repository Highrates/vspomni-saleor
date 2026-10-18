import { Module } from '@nestjs/common';
import { DashboardAdminController } from './dashboard-admin.controller';
import { DashboardAdminService } from './dashboard-admin.service';

@Module({
  controllers: [DashboardAdminController],
  providers: [DashboardAdminService],
  exports: [DashboardAdminService],
})
export class DashboardModule {}
