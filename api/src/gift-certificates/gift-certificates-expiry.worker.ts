import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GiftCertificatesAdminService } from './gift-certificates-admin.service';

/** Периодически помечает просроченные ACTIVE → EXPIRED. */
@Injectable()
export class GiftCertificatesExpiryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GiftCertificatesExpiryWorker.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly gifts: GiftCertificatesAdminService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const ms = 60_000;
    this.timer = setInterval(() => {
      void this.prisma
        .runInRlsTransaction({ userId: '', bypass: true }, () =>
          this.gifts.expireOverdueCertificates(),
        )
        .then((n) => {
          if (n > 0) this.logger.log(`Marked ${n} gift certificate(s) EXPIRED`);
        })
        .catch((err) => this.logger.warn(`Gift expire failed: ${String(err)}`));
    }, ms);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
