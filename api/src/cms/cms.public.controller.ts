import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CmsPublicService } from './cms.service';

@Public()
@Controller('cms')
export class CmsPublicController {
  constructor(private readonly cms: CmsPublicService) {}

  @Get('pages/:slug')
  getBySlug(@Param('slug') slug: string) {
    return this.cms.getBySlug(slug);
  }
}
