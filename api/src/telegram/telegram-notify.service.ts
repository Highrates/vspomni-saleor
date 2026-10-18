import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

function formatRub(amount: number): string {
  return `${amount.toLocaleString('ru-RU')} ₽`;
}

@Injectable()
export class TelegramNotifyService {
  private readonly logger = new Logger(TelegramNotifyService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.token() && this.chatIds().length > 0);
  }

  private token(): string {
    return (this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '').trim();
  }

  /** База API: на RU VPS часто нужен прокси (Cloudflare Worker), не api.telegram.org */
  private apiBase(): string {
    const raw = (
      this.config.get<string>('TELEGRAM_API_BASE') ?? 'https://api.telegram.org'
    ).trim();
    return raw.replace(/\/+$/, '') || 'https://api.telegram.org';
  }

  private chatIds(): string[] {
    const raw = (this.config.get<string>('TELEGRAM_ORDER_CHAT_IDS') ?? '').trim();
    if (!raw) return [];
    return raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private adminOrderUrl(orderId: string): string {
    const admin =
      this.config.get<string>('ADMIN_PUBLIC_URL')?.trim().replace(/\/+$/, '') ||
      '';
    if (admin) return `${admin}/admin/orders/${orderId}`;
    const site =
      this.config.get<string>('FRONTEND_PUBLIC_URL')?.trim().replace(/\/+$/, '') ||
      '';
    return site ? `${site}/admin/orders/${orderId}` : `/admin/orders/${orderId}`;
  }

  /** Уведомление staff о оплаченном заказе (товарный или сертификат). */
  async notifyOrderPaid(orderNumber: string): Promise<void> {
    if (!this.isConfigured()) return;

    const order = await this.prisma.order.findUnique({
      where: { number: orderNumber },
      select: {
        id: true,
        number: true,
        email: true,
        phone: true,
        customerName: true,
        total: true,
        shippingCost: true,
        discountTotal: true,
        giftCertificateAmount: true,
        giftPurchaseDenominationId: true,
        giftPurchaseRecipientEmail: true,
        shippingMethod: true,
        customerNote: true,
        items: {
          orderBy: { id: 'asc' },
          select: {
            title: true,
            qty: true,
            lineTotal: true,
            isGratitudeGift: true,
          },
        },
      },
    });
    if (!order) {
      this.logger.warn(`Telegram: order ${orderNumber} not found`);
      return;
    }

    const isGift = Boolean(order.giftPurchaseDenominationId);
    const lines: string[] = [];
    lines.push(isGift ? '🎁 Оплачен сертификат' : '🛒 Новый оплаченный заказ');
    lines.push(`#${order.number}`);
    lines.push(`Сумма: ${formatRub(order.total)}`);
    if (order.customerName?.trim()) {
      lines.push(`Клиент: ${order.customerName.trim()}`);
    }
    lines.push(`Тел: ${order.phone}`);
    lines.push(`Email: ${order.email}`);
    if (isGift && order.giftPurchaseRecipientEmail) {
      lines.push(`Получатель сертификата: ${order.giftPurchaseRecipientEmail}`);
    }
    if (order.shippingMethod) {
      lines.push(`Доставка: ${order.shippingMethod} (${formatRub(order.shippingCost)})`);
    }
    if (order.discountTotal > 0) {
      lines.push(`Скидка: −${formatRub(order.discountTotal)}`);
    }
    if (order.giftCertificateAmount > 0) {
      lines.push(`Сертификатом: −${formatRub(order.giftCertificateAmount)}`);
    }
    if (order.items.length > 0) {
      lines.push('');
      lines.push('Состав:');
      for (const it of order.items) {
        const gift = it.isGratitudeGift ? ' (подарок)' : '';
        lines.push(`• ${it.title}${gift} × ${it.qty} — ${formatRub(it.lineTotal)}`);
      }
    }
    if (order.customerNote?.trim()) {
      lines.push('');
      lines.push(`Комментарий: ${order.customerNote.trim()}`);
    }
    lines.push('');
    lines.push(this.adminOrderUrl(order.id));

    await this.sendToAll(lines.join('\n'));
  }

  async sendText(text: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('Telegram skipped (TELEGRAM_BOT_TOKEN / TELEGRAM_ORDER_CHAT_IDS)');
      return;
    }
    await this.sendToAll(text);
  }

  private async sendToAll(text: string): Promise<void> {
    const token = this.token();
    const ids = this.chatIds();
    await Promise.all(
      ids.map(async (chatId) => {
        try {
          await this.sendMessage(token, chatId, text);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.warn(`Telegram send failed → ${chatId}: ${msg}`);
        }
      }),
    );
  }

  private async sendMessage(
    token: string,
    chatId: string,
    text: string,
  ): Promise<void> {
    const url = `${this.apiBase()}/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
    }
  }
}
