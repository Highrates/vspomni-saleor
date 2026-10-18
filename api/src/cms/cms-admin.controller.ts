import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DiscardCmsUploadsDto, UpdateCmsPageDto } from './dto/cms-page.dto';
import { CmsAdminService } from './cms.service';

@Controller('cms/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class CmsAdminController {
  constructor(private readonly cms: CmsAdminService) {}

  @Get('legal')
  listLegal() {
    return this.cms.listLegal();
  }

  @Get('about')
  listAbout() {
    return this.cms.listAbout();
  }

  @Get('pages/:slug')
  getBySlug(@Param('slug') slug: string) {
    return this.cms.getBySlug(slug);
  }

  @Put('pages/:slug')
  updateBySlug(@Param('slug') slug: string, @Body() dto: UpdateCmsPageDto) {
    return this.cms.updateBySlug(slug, dto);
  }

  @Post('discard-uploads')
  discardUploads(@Body() dto: DiscardCmsUploadsDto) {
    return this.cms.discardCmsUploads(dto.urls);
  }
}
