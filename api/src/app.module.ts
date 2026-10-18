import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { UsersModule } from './users/users.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DiscountsModule } from './discounts/discounts.module';
import { BlogModule } from './blog/blog.module';
import { CmsModule } from './cms/cms.module';
import { PromoModule } from './promo/promo.module';
import { GiftCertificatesModule } from './gift-certificates/gift-certificates.module';
import { OrdersModule } from './orders/orders.module';
import { SearchModule } from './search/search.module';
import { AccountModule } from './account/account.module';
import { SettingsModule } from './settings/settings.module';
import { StaffModule } from './staff/staff.module';
import { MailModule } from './mail/mail.module';
import { TelegramModule } from './telegram/telegram.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UserGroupsModule } from './user-groups/user-groups.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { OzonModule } from './ozon/ozon.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RlsInterceptor } from './rls/rls.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      getTracker: (req: { ips?: string[]; ip?: string; headers?: Record<string, unknown> }) => {
        const xf = req.headers?.['x-forwarded-for'];
        if (typeof xf === 'string' && xf.trim()) {
          return xf.split(',')[0]!.trim();
        }
        if (Array.isArray(req.ips) && req.ips[0]) return req.ips[0];
        return req.ip || 'unknown';
      },
    }),
    PrismaModule,
    MailModule,
    TelegramModule,
    StaffModule,
    AuthModule,
    CatalogModule,
    UsersModule,
    DashboardModule,
    DiscountsModule,
    BlogModule,
    CmsModule,
    PromoModule,
    GiftCertificatesModule,
    OrdersModule,
    SearchModule,
    AccountModule,
    SettingsModule,
    ReviewsModule,
    UserGroupsModule,
    NewsletterModule,
    OzonModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RlsInterceptor,
    },
  ],
})
export class AppModule {}
