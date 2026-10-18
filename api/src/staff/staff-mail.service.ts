import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';

export type StaffMailDelivery = { delivered: boolean };

/**
 * Доставка писем сотрудникам через SMTP.
 * При ошибке/без конфига: delivered=false — админ получает temporaryPassword в API.
 * Пароль в логи не пишется.
 */
@Injectable()
export class StaffMailService {
  private readonly logger = new Logger(StaffMailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  isDev(): boolean {
    return (this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV) !== 'production';
  }

  resolveAdminLoginUrl(): string {
    const base =
      this.config.get<string>('FRONTEND_PUBLIC_URL')?.replace(/\/+$/, '') ||
      (this.isDev() ? 'http://localhost:3000' : '');
    if (!base) {
      throw new Error('Не задан FRONTEND_PUBLIC_URL для ссылки входа');
    }
    return `${base}/admin/login`;
  }

  async sendStaffAdminWelcome(input: {
    to: string;
    password: string;
    loginUrl: string;
    staffDisplayName: string | null;
  }): Promise<StaffMailDelivery> {
    if (!this.mail.isConfigured()) {
      this.logger.warn(
        `Staff welcome not sent to ${input.to}: SMTP not configured; password not logged`,
      );
      return { delivered: false };
    }
    try {
      await this.mail.sendStaffAdminWelcome(input);
      return { delivered: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `Staff welcome failed for ${input.to}: ${msg}; password not logged`,
      );
      return { delivered: false };
    }
  }

  async sendStaffAdminPasswordReset(input: {
    to: string;
    password: string;
    loginUrl: string;
    staffDisplayName: string | null;
  }): Promise<StaffMailDelivery> {
    if (!this.mail.isConfigured()) {
      this.logger.warn(
        `Staff password reset not sent to ${input.to}: SMTP not configured; password not logged`,
      );
      return { delivered: false };
    }
    try {
      await this.mail.sendStaffAdminPasswordReset(input);
      return { delivered: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `Staff password reset failed for ${input.to}: ${msg}; password not logged`,
      );
      return { delivered: false };
    }
  }
}
