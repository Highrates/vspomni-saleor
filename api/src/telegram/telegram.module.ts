import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramNotifyService } from './telegram-notify.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [TelegramNotifyService],
  exports: [TelegramNotifyService],
})
export class TelegramModule {}
