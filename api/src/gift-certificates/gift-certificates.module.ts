import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { OrderPayTokenService } from '../orders/order-pay-token.service';
import { GiftCertificatesAdminController } from './gift-certificates-admin.controller';
import { GiftCertificatesAdminService } from './gift-certificates-admin.service';
import { GiftCertificatesPublicController } from './gift-certificates.public.controller';
import { GiftCertificatesPublicService } from './gift-certificates.public.service';
import { GiftCertificatesExpiryWorker } from './gift-certificates-expiry.worker';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [GiftCertificatesAdminController, GiftCertificatesPublicController],
  providers: [
    GiftCertificatesAdminService,
    GiftCertificatesPublicService,
    OrderPayTokenService,
    GiftCertificatesExpiryWorker,
  ],
  exports: [GiftCertificatesAdminService, GiftCertificatesPublicService],
})
export class GiftCertificatesModule {}
