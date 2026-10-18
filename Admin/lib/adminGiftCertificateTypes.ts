export type GiftCertificateStatus = 'ACTIVE' | 'USED_UP' | 'EXPIRED' | 'REVOKED';

export type AdminGiftDenominationImage = {
  id: string;
  url: string;
  mediaType?: string;
  sortOrder: number;
};

export type AdminGiftDenomination = {
  id: string;
  name: string;
  faceValue: number;
  validityDays: number | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  images?: AdminGiftDenominationImage[];
  _count?: { certificates: number };
};

export type AdminGiftCertificate = {
  id: string;
  code: string;
  denominationId: string | null;
  faceValue: number;
  balance: number;
  status: GiftCertificateStatus;
  source: string;
  issuedAt: string;
  expiresAt: string | null;
  recipientEmail: string | null;
  recipientUserId: string | null;
  issuedByUserId: string | null;
  note: string | null;
  purchaseOrderId: string | null;
  createdAt: string;
  updatedAt: string;
  denomination?: { id: string; name: string; faceValue: number } | null;
  issuedBy?: { id: string; email: string; label: string } | null;
  purchaseOrder?: { id: string; number: string | null } | null;
  ledger?: AdminGiftLedgerEntry[];
  ledgerTotal?: number;
  ledgerPage?: number;
  ledgerLimit?: number;
};

export type AdminGiftLedgerEntry = {
  id: string;
  kind: string;
  amount: number;
  balanceAfter: number;
  orderId: string | null;
  actorUserId: string | null;
  /** Подпись актёра (staffDisplayName / displayName / email) */
  actor?: { id: string; email: string; label: string } | null;
  order?: { id: string; number: string | null } | null;
  note: string | null;
  createdAt: string;
};

export type AdminGiftCertificateListResponse = {
  items: AdminGiftCertificate[];
  total: number;
  page: number;
  limit: number;
};

export type IssueGiftCertificatesResponse = {
  items: Array<{
    id: string;
    code: string;
    faceValue: number;
    balance: number;
    status: GiftCertificateStatus;
    expiresAt: string | null;
  }>;
  count: number;
  /** false = SMTP не настроен / ошибка; undefined = email не запрашивали */
  emailDelivered?: boolean;
};

export type DeleteDenominationResponse = {
  ok: true;
  deleted: boolean;
  deactivated: boolean;
  denomination?: AdminGiftDenomination;
};

/** Маскировка для списка админки (скриншоты). */
export function maskGiftCodeDisplay(code: string): string {
  const n = code.trim().toUpperCase();
  const parts = n.split('-');
  if (parts.length >= 4) {
    return `${parts[0]}-${parts[1]}-****-****`;
  }
  if (n.length <= 6) return '****';
  return `${n.slice(0, 6)}…`;
}

export const GIFT_STATUS_LABEL_RU: Record<GiftCertificateStatus, string> = {
  ACTIVE: 'Активен',
  USED_UP: 'Израсходован',
  EXPIRED: 'Истёк',
  REVOKED: 'Отозван',
};

export const GIFT_LEDGER_KIND_RU: Record<string, string> = {
  ISSUE: 'Выпуск',
  CAPTURE: 'Списание',
  RELEASE: 'Возврат',
  ADJUST: 'Корректировка',
  REVOKE: 'Отзыв',
};
