/**
 * HTML-каркас писем Vspomni.
 * Палитра витрины: ink / snow / accent blue. Лого — PNG с витрины (не SVG).
 */

export const MAIL_BRAND = {
  name: 'Vspomni',
  ink: '#111111',
  inkSoft: '#2a2a2a',
  muted: '#5b6166',
  line: '#e5e7eb',
  snow: '#fafafa',
  white: '#ffffff',
  accent: '#3a7fe2',
  replyHint: 'info@vspomni.store',
  /** @deprecated alias — старые шаблоны */
  green: '#111111',
  greenDark: '#000000',
  sand: '#fafafa',
} as const;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeHtml(s: string): string {
  return esc(s);
}

export type MailLayoutInput = {
  preheader?: string;
  bodyHtml: string;
  /** Абсолютный URL витрины — для лого и футера */
  siteUrl?: string | null;
};

function logoBlock(site: string): string {
  const { ink, name } = MAIL_BRAND;
  const text = `<span style="font-family:${FONT};font-size:18px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${ink};line-height:1;">${esc(name)}</span>`;
  if (!site) return text;
  const src = `${site}/logo/logo-vspomni.png`;
  return `<a href="${esc(site)}" style="text-decoration:none;display:inline-block;">
  <img src="${esc(src)}" width="140" height="40" alt="${esc(name)}" style="display:block;border:0;outline:none;height:40px;width:auto;max-width:160px;"/>
</a>
<!--[if !mso]><!--><div style="display:none;max-height:0;overflow:hidden;">${text}</div><!--<![endif]-->`;
}

/**
 * Каркас: snow-фон, белая карточка, лого PNG, системный sans, футер.
 */
export function renderVspomniEmailLayout(input: MailLayoutInput): string {
  const { ink, muted, line, snow, white, name, replyHint, accent } = MAIL_BRAND;
  const pre = esc((input.preheader ?? '').trim());
  const site = (input.siteUrl ?? '').replace(/\/+$/, '');
  const siteLink = site
    ? `<a href="${esc(site)}" style="color:${accent};text-decoration:none">${esc(site.replace(/^https?:\/\//, ''))}</a>`
    : `<span style="color:${muted}">vspomni.store</span>`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light only"/>
<meta name="supported-color-schemes" content="light"/>
<title>${esc(name)}</title>
</head>
<body style="margin:0;padding:0;background:${snow};-webkit-text-size-adjust:100%;">
${pre ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${pre}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${snow};">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${white};border-radius:0;overflow:hidden;border:1px solid ${line};">
        <tr>
          <td style="padding:28px 32px 20px;border-bottom:1px solid ${line};">
            ${logoBlock(site)}
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 12px;font-family:${FONT};font-size:15px;line-height:1.55;color:${ink};">
            ${input.bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px;font-family:${FONT};font-size:12px;line-height:1.5;color:${muted};border-top:1px solid ${line};">
            <p style="margin:0 0 8px;">С теплом,<br/><span style="color:${ink};font-weight:600">${esc(name)}</span></p>
            <p style="margin:0;">${siteLink}
              · <a href="mailto:${esc(replyHint)}" style="color:${muted};text-decoration:none">${esc(replyHint)}</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function mailEyebrow(text: string): string {
  const { muted } = MAIL_BRAND;
  return `<p style="margin:0 0 8px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${muted};">${esc(text)}</p>`;
}

export function mailHeading(text: string): string {
  const { ink } = MAIL_BRAND;
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:22px;font-weight:700;line-height:1.3;color:${ink};letter-spacing:-0.01em;">${esc(text)}</p>`;
}

export function mailCtaButton(href: string, label: string): string {
  const { ink, white } = MAIL_BRAND;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
  <tr>
    <td style="border-radius:0;background:${ink};">
      <a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:${white};text-decoration:none;letter-spacing:0.02em;">
        ${esc(label)}
      </a>
    </td>
  </tr>
</table>`;
}

export function mailMutedNote(text: string): string {
  const { muted } = MAIL_BRAND;
  return `<p style="margin:20px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${muted};">${esc(text)}</p>`;
}

/** Карточка с крупным кодом / номером заказа. */
export function mailCodeCard(value: string): string {
  const { ink, snow, line } = MAIL_BRAND;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
  <tr>
    <td align="center" style="padding:22px 16px;background:${snow};border:1px solid ${line};">
      <span style="font-family:${FONT};font-size:28px;letter-spacing:0.22em;font-weight:700;color:${ink};">${esc(value)}</span>
    </td>
  </tr>
</table>`;
}
