import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminGuard } from '../common/guards/admin.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateStaffAdminDto, UpdateStaffAdminDto } from './dto/staff-admin.dto';
import { StaffAdminService } from './staff-admin.service';
import { IMAGE_MAX_BYTES } from '../storage/local-storage.service';

/** CRUD сотрудников — только суперадмин. */
@Controller('settings/admin/staff')
@UseGuards(JwtAuthGuard, AdminGuard, SuperAdminGuard)
export class StaffAdminController {
  constructor(private readonly staffAdmin: StaffAdminService) {}

  @Get('sections')
  listSections() {
    return this.staffAdmin.listSectionCatalog();
  }

  @Get()
  list() {
    return this.staffAdmin.listStaff();
  }

  @Post()
  create(@CurrentUser('sub') actorUserId: string, @Body() dto: CreateStaffAdminDto) {
    return this.staffAdmin.createStaff(actorUserId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('sub') actorUserId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStaffAdminDto,
  ) {
    return this.staffAdmin.updateStaff(actorUserId, id, dto);
  }

  @Post(':id/reset-password')
  resetPassword(@CurrentUser('sub') actorUserId: string, @Param('id') id: string) {
    return this.staffAdmin.resetPassword(actorUserId, id);
  }

  @Post(':id/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: IMAGE_MAX_BYTES },
    }),
  )
  uploadAvatar(
    @CurrentUser('sub') actorUserId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.staffAdmin.uploadStaffAvatar(actorUserId, id, file);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@CurrentUser('sub') actorUserId: string, @Param('id') id: string) {
    return this.staffAdmin.deleteStaff(actorUserId, id);
  }
}
