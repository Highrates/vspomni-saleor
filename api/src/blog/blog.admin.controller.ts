import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { parseOptionalPositiveInt } from '../common/parse-positive-int';
import { BlogAdminService } from './blog.admin.service';
import {
  BulkIdsDto,
  CreateBlogCategoryAdminDto,
  CreateBlogPostAdminDto,
  DiscardBlogUploadsDto,
  ReorderBlogCategoriesDto,
  ReorderBlogPostsDto,
  UpdateBlogCategoryAdminDto,
  UpdateBlogPostAdminDto,
} from './dto/blog-admin.dto';

@Controller('blog/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class BlogAdminController {
  constructor(private readonly blogAdmin: BlogAdminService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 6 * 1024 * 1024 },
    }),
  )
  uploadCover(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не передан');
    return this.blogAdmin.uploadCover(file);
  }

  @Post('discard-uploads')
  discardUploads(@Body() dto: DiscardBlogUploadsDto) {
    return this.blogAdmin.discardUploads(dto.urls);
  }

  @Get('categories')
  listCategories() {
    return this.blogAdmin.listCategoriesAdmin();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateBlogCategoryAdminDto) {
    return this.blogAdmin.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateBlogCategoryAdminDto) {
    return this.blogAdmin.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.blogAdmin.deleteCategory(id);
  }

  @Post('categories/reorder')
  reorderCategories(@Body() dto: ReorderBlogCategoriesDto) {
    return this.blogAdmin.reorderCategories(dto.orderedIds);
  }

  @Get('posts')
  listPosts(
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
    @Query('published') published?: 'all' | 'published' | 'draft',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pub =
      published === 'published' || published === 'draft' ? published : 'all';
    return this.blogAdmin.listPostsAdmin({
      q,
      categoryId,
      published: pub,
      page: parseOptionalPositiveInt(page),
      limit: parseOptionalPositiveInt(limit),
    });
  }

  @Get('posts/:id')
  getPost(@Param('id') id: string) {
    return this.blogAdmin.getPostAdmin(id);
  }

  @Post('posts')
  createPost(
    @Body() dto: CreateBlogPostAdminDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.blogAdmin.createPost(dto, userId);
  }

  @Patch('posts/:id')
  updatePost(@Param('id') id: string, @Body() dto: UpdateBlogPostAdminDto) {
    return this.blogAdmin.updatePost(id, dto);
  }

  @Delete('posts/:id')
  deletePost(@Param('id') id: string) {
    return this.blogAdmin.deletePost(id);
  }

  @Post('posts/bulk-delete')
  bulkDeletePosts(@Body() dto: BulkIdsDto) {
    return this.blogAdmin.bulkDeletePosts(dto);
  }

  @Post('posts/reorder')
  reorderPosts(@Body() dto: ReorderBlogPostsDto) {
    return this.blogAdmin.reorderPosts(dto);
  }
}
