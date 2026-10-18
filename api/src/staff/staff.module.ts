import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AdminGuard } from '../common/guards/admin.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { StaffAdminController } from './staff-admin.controller';
import { StaffSelfController } from './staff-self.controller';
import { StaffAccessService } from './staff-access.service';
import { StaffAdminService } from './staff-admin.service';
import { StaffMailService } from './staff-mail.service';

@Global()
@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [StaffSelfController, StaffAdminController],
  providers: [
    StaffAccessService,
    StaffAdminService,
    StaffMailService,
    AdminGuard,
    SuperAdminGuard,
  ],
  exports: [
    StaffAccessService,
    StaffAdminService,
    StaffMailService,
    AdminGuard,
    SuperAdminGuard,
  ],
})
export class StaffModule {}
