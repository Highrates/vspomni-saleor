import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateStaffSelfDto } from './dto/staff-self.dto';
import { StaffAdminService } from './staff-admin.service';
import { IMAGE_MAX_BYTES } from '../storage/local-storage.service';

/**
 * Профиль текущего сотрудника.
 * Отдельный base path — не пересекается с `settings/admin/staff/:id`.
 */
@Controller('settings/admin/staff-profile')
@UseGuards(JwtAuthGuard, AdminGuard)
export class StaffSelfController {
  constructor(private readonly staffAdmin: StaffAdminService) {}

  @Get()
  getMe(@CurrentUser('sub') userId: string) {
    return this.staffAdmin.getStaffSelf(userId);
  }

  @Patch()
  updateMe(@CurrentUser('sub') userId: string, @Body() dto: UpdateStaffSelfDto) {
    return this.staffAdmin.updateStaffSelf(userId, dto);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: IMAGE_MAX_BYTES },
    }),
  )
  uploadAvatar(@CurrentUser('sub') userId: string, @UploadedFile() file: Express.Multer.File) {
    return this.staffAdmin.uploadStaffAvatar(userId, userId, file);
  }

  @Post('reset-password')
  resetPassword(@CurrentUser('sub') userId: string) {
    return this.staffAdmin.resetPassword(userId, userId);
  }
}
