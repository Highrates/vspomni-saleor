import { describe, expect, it } from 'vitest';
import {
  accountOrderChatUrl,
  accountSupportChatUrl,
} from './email-notification-format';

describe('account chat deep links', () => {
  it('order chat includes chatOrder query', () => {
    expect(accountOrderChatUrl('https://vspomni.store', 'ord-1')).toBe(
      'https://vspomni.store/profile?tab=orders&chatOrder=ord-1',
    );
  });

  it('support chat includes chatSupport flag', () => {
    expect(accountSupportChatUrl('https://vspomni.store/')).toBe(
      'https://vspomni.store/profile?chatSupport=1',
    );
  });
});
