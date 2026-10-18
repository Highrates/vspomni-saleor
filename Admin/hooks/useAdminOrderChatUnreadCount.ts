'use client';

export type AdminChatUnreadCounts = {
  support: number;
  orders: number;
};

/** Chat disabled for Vspomni — always empty. */
export function useAdminOrderChatUnreadCount(_enabled: boolean): AdminChatUnreadCounts {
  return { support: 0, orders: 0 };
}
