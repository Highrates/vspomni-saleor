import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RegistrationService } from './registration.service';

/** Раз в 15 мин чистит expired RegistrationChallenge / RegistrationCompletion. */
@Injectable()
export class RegistrationCleanupWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RegistrationCleanupWorker.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly registration: RegistrationService) {}

  onModuleInit() {
    const ms = 15 * 60_000;
    this.timer = setInterval(() => {
      void this.registration
        .purgeExpired()
        .then((n) => {
          if (n.challenges + n.completions > 0) {
            this.logger.log(
              `Purged registration rows: challenges=${n.challenges}, completions=${n.completions}, dispatches=${n.dispatches}`,
            );
          }
        })
        .catch((err) => this.logger.warn(`Purge failed: ${String(err)}`));
    }, ms);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
