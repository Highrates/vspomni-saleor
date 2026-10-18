import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { ReviewsAdminController } from './reviews.admin.controller';
import { ReviewsAdminService } from './reviews.admin.service';
import { ReviewsPublicController } from './reviews.public.controller';
import { ReviewsPublicService } from './reviews.public.service';

@Module({
  imports: [StorageModule],
  controllers: [ReviewsPublicController, ReviewsAdminController],
  providers: [ReviewsPublicService, ReviewsAdminService],
  exports: [ReviewsPublicService],
})
export class ReviewsModule {}
