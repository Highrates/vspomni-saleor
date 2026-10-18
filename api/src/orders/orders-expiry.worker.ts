import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersPublicService } from './orders.public.service';

/** Периодически снимает резерв с просроченных AWAITING_PAYMENT. */
@Injectable()
export class OrdersExpiryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersExpiryWorker.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly orders: OrdersPublicService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const ms = 60_000;
    this.timer = setInterval(() => {
      void this.prisma
        .runInRlsTransaction({ userId: '', bypass: true }, () =>
          this.orders.expireStaleAwaitingOrders(),
        )
        .then((n) => {
          if (n > 0) this.logger.log(`Expired ${n} awaiting order(s)`);
        })
        .catch((err) => this.logger.warn(`Expire failed: ${String(err)}`));
    }, ms);
    // не держим процесс ради таймера
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
