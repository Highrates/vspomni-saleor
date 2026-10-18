import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { BlogAdminController } from './blog.admin.controller';
import { BlogAdminService } from './blog.admin.service';
import { BlogPublicController } from './blog.public.controller';
import { BlogPublicService } from './blog.public.service';

@Module({
  imports: [StorageModule],
  controllers: [BlogPublicController, BlogAdminController],
  providers: [BlogPublicService, BlogAdminService],
})
export class BlogModule {}
