import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TelegramNotifyService } from './telegram-notify.service';

describe('TelegramNotifyService', () => {
  const configGet = vi.fn();
  const prisma = {
    order: { findUnique: vi.fn() },
  };
  let svc: TelegramNotifyService;

  beforeEach(() => {
    vi.restoreAllMocks();
    configGet.mockReset();
    prisma.order.findUnique.mockReset();
    svc = new TelegramNotifyService(
      { get: configGet } as never,
      prisma as never,
    );
  });

  it('isConfigured false without token/chats', () => {
    configGet.mockReturnValue('');
    expect(svc.isConfigured()).toBe(false);
  });

  it('isConfigured true with token and chat ids', () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'TELEGRAM_BOT_TOKEN') return 'tok';
      if (key === 'TELEGRAM_ORDER_CHAT_IDS') return '1, 2';
      return '';
    });
    expect(svc.isConfigured()).toBe(true);
  });

  it('notifyOrderPaid sends to all chat ids', async () => {
    configGet.mockImplementation((key: string) => {
      if (key === 'TELEGRAM_BOT_TOKEN') return 'tok';
      if (key === 'TELEGRAM_ORDER_CHAT_IDS') return '111,222';
      if (key === 'ADMIN_PUBLIC_URL') return 'https://admin.test';
      return '';
    });
    prisma.order.findUnique.mockResolvedValue({
      id: 'oid',
      number: 'A-1',
      email: 'a@b.c',
      phone: '+7000',
      customerName: 'Иван',
      total: 1500,
      shippingCost: 300,
      discountTotal: 0,
      giftCertificateAmount: 0,
      giftPurchaseDenominationId: null,
      giftPurchaseRecipientEmail: null,
      shippingMethod: 'CDEK',
      customerNote: null,
      items: [{ title: 'Саше', qty: 1, lineTotal: 1200, isGratitudeGift: false }],
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    await svc.notifyOrderPaid('A-1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.chat_id).toBe('111');
    expect(body.text).toContain('#A-1');
    expect(body.text).toContain('1\u00a0500 ₽');
    expect(body.text).toContain('https://admin.test/admin/orders/oid');
  });
});
