import { Module } from '@nestjs/common';
import { OrderChatService } from './order-chat.service';

@Module({
  providers: [OrderChatService],
  exports: [OrderChatService],
})
export class OrderChatModule {}
