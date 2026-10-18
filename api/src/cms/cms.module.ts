import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { CmsAdminController } from './cms-admin.controller';
import { CmsPublicController } from './cms.public.controller';
import { CmsAdminService, CmsPublicService } from './cms.service';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [CmsAdminController, CmsPublicController],
  providers: [CmsAdminService, CmsPublicService],
})
export class CmsModule {}
