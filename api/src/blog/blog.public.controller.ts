import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { BlogPublicService, parseBlogListQuery } from './blog.public.service';

@Public()
@Controller('blog')
export class BlogPublicController {
  constructor(private readonly blog: BlogPublicService) {}

  @Get('categories')
  categories() {
    return this.blog.listCategories();
  }

  @Get('posts')
  async posts(
    @Query('categoryId') categoryId?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.blog.listPosts(
      parseBlogListQuery({ categoryId, categorySlug, page, limit }),
    );
    if (result.categoryMissing) {
      throw new NotFoundException('Рубрика не найдена');
    }
    return {
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get('posts/:slug')
  async post(@Param('slug') slug: string) {
    let s = slug;
    try {
      s = decodeURIComponent(slug);
    } catch {
      /* as-is */
    }
    const row = await this.blog.getPostBySlug(s);
    if (!row) throw new NotFoundException('Статья не найдена');
    return row;
  }
}
