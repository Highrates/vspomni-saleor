import { Injectable } from '@nestjs/common';
import type { OrderStatus } from '@prisma/client';

/**
 * No-op stub. Support chat is not part of Vspomni admin;
 * orders/account still call these hooks for lifecycle parity with Mira.
 */
@Injectable()
export class OrderChatService {
  async unreadOrderChatCountsForStaff(
    _staffUserId: string,
    orderIds: string[],
  ): Promise<Record<string, number>> {
    return Object.fromEntries(orderIds.map((id) => [id, 0]));
  }

  async orderChatMessageCountsForOrders(
    orderIds: string[],
  ): Promise<Record<string, number>> {
    return Object.fromEntries(orderIds.map((id) => [id, 0]));
  }

  async applyRetentionForOrder(_orderId: string, _status: OrderStatus): Promise<void> {}

  async seedCustomerNoteFromOrder(_orderId: string): Promise<void> {}

  async seedCustomerNotesForUser(_userId: string): Promise<void> {}

  disconnectRealtimeSessionsForUser(_userId: string): void {}
}
