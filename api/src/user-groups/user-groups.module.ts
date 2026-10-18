import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CatalogVisibilityService } from './catalog-visibility.service';
import { CommerceContextService } from './commerce-context.service';
import { GroupPricingService } from './group-pricing.service';
import { UserGroupsAdminService } from './user-groups-admin.service';
import { UserGroupsSharedCacheService } from './user-groups-shared-cache.service';

/**
 * Pricing / visibility helpers for the catalog.
 * Admin controllers are not registered (no user-groups UI in Vspomni).
 */
@Module({
  imports: [PrismaModule],
  providers: [
    UserGroupsSharedCacheService,
    CommerceContextService,
    GroupPricingService,
    CatalogVisibilityService,
    UserGroupsAdminService,
  ],
  exports: [
    UserGroupsSharedCacheService,
    CommerceContextService,
    GroupPricingService,
    CatalogVisibilityService,
    UserGroupsAdminService,
  ],
})
export class UserGroupsModule {}
