// Resend transactional email service & D1 email_outbox for DEYNOLD DANNY

import { GATEWAY_FETCH_TIMEOUT_MS } from '../config/constants.js';
import { nowIso } from '../db/client.js';
import { generateId } from './crypto.js';

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM_ADDRESS = 'DEYNOLD DANNY <concierge@deynolddanny.com>';

function escapeHtml(raw: unknown): string {
  const str = String(raw ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isConfiguredResendKey(key: string | undefined): boolean {
  return Boolean(key && key.startsWith('re_') && !key.includes('your_resend'));
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  resendApiKey: string,
  fromAddress = DEFAULT_FROM_ADDRESS,
): Promise<boolean> {
  if (!isConfiguredResendKey(resendApiKey)) {
    return false;
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress || DEFAULT_FROM_ADDRESS,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }
  return true;
}

/**
 * Persists an email into `email_outbox` with deduplication and delivers idempotently.
 */
export async function recordAndSendEmail(
  db: D1Database,
  dedupeKey: string,
  emailType: string,
  recipient: string,
  payload: unknown,
  senderFn: () => Promise<boolean>,
): Promise<void> {
  const outboxId = generateId('eml_');
  const now = nowIso();

  try {
    const insertRes = await db
      .prepare(
        `INSERT OR IGNORE INTO email_outbox (id, dedupe_key, recipient, email_type, payload_json, status, attempts, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'pending', 0, ?6)`,
      )
      .bind(outboxId, dedupeKey, recipient, emailType, JSON.stringify(payload), now)
      .run();

    // If duplicate key was already queued/sent, skip
    if ((insertRes.meta.changes ?? 0) === 0) {
      return;
    }

    const sent = await senderFn();
    await db
      .prepare(
        `UPDATE email_outbox
         SET status = ?1, attempts = attempts + 1, sent_at = CASE WHEN ?1 = 'sent' THEN ?2 ELSE NULL END
         WHERE id = ?3`,
      )
      .bind(sent ? 'sent' : 'skipped', nowIso(), outboxId)
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      await db
        .prepare(
          `UPDATE email_outbox SET status = 'failed', attempts = attempts + 1, last_error = ?1 WHERE id = ?2`,
        )
        .bind(msg.slice(0, 500), outboxId)
        .run();
    } catch {
      // ignore outbox error
    }
    throw err;
  }
}

function buildOtpHtml(otp: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<style>
body{margin:0;padding:0;background-color:#faf9f6;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#111111;}
.container{max-width:540px;margin:40px auto;background-color:#ffffff;border:1px solid #eaeaea;padding:48px;}
.logo{text-align:center;margin-bottom:36px;}
.title{font-family:Georgia,serif;font-size:24px;font-weight:400;text-align:center;letter-spacing:0.04em;margin-bottom:16px;color:#111111;}
.text{font-size:14px;line-height:1.6;color:#555555;text-align:center;margin-bottom:32px;}
.code-box{background-color:#111111;color:#ffffff;font-family:'Courier New',monospace;font-size:32px;font-weight:600;letter-spacing:8px;text-align:center;padding:20px;margin-bottom:32px;}
.footer{font-size:11px;color:#888888;text-align:center;border-top:1px solid #f0f0f0;padding-top:24px;text-transform:uppercase;letter-spacing:0.08em;}
</style></head>
<body>
<div class="container">
  <div class="logo">
    <h2 style="letter-spacing:0.2em;font-weight:600;font-size:16px;margin:0;">DEYNOLD DANNY</h2>
    <p style="font-size:9px;letter-spacing:0.15em;color:#777;margin:4px 0 0 0;">ATELIER &bull; CLIENT CARE</p>
  </div>
  <div class="title">Verification Code</div>
  <p class="text">Please enter the security verification code below to access your client account.</p>
  <div class="code-box">${escapeHtml(otp)}</div>
  <p class="text" style="font-size:12px;color:#888;">This code remains active for 10 minutes. If you did not request this, you may safely ignore this correspondence.</p>
  <div class="footer">&copy; 2026 DEYNOLD DANNY. ALL RIGHTS RESERVED.</div>
</div>
</body></html>`;
}

export async function sendOtpEmail(
  resendApiKey: string,
  to: string,
  otp: string,
  fromAddress?: string,
): Promise<boolean> {
  return sendEmail(to, 'Your DEYNOLD DANNY Verification Code', buildOtpHtml(otp), resendApiKey, fromAddress);
}

export interface OrderEmailItem {
  title: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: string;
  [key: string]: unknown;
}

function buildOrderItemsRows(items: OrderEmailItem[]): string {
  return items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;">
          ${escapeHtml(item.title)}<br>
          <span style="font-size:11px;color:#888;">${escapeHtml(item.color)} / ${escapeHtml(item.size)}</span>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;text-align:center;">${escapeHtml(item.quantity)}</td>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;text-align:right;">${escapeHtml(item.unitPrice)}</td>
      </tr>`,
    )
    .join('');
}

function buildOrderConfirmedHtml(
  orderNumber: string,
  totalFormatted: string,
  items: OrderEmailItem[],
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<style>
body{margin:0;padding:0;background-color:#faf9f6;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#111111;}
.container{max-width:600px;margin:40px auto;background-color:#ffffff;border:1px solid #eaeaea;padding:48px;}
.logo{text-align:center;margin-bottom:36px;}
.title{font-family:Georgia,serif;font-size:22px;font-weight:400;text-align:center;letter-spacing:0.04em;margin-bottom:8px;color:#111111;}
.subtitle{font-size:13px;color:#888;text-align:center;margin-bottom:36px;letter-spacing:0.06em;text-transform:uppercase;}
table{width:100%;border-collapse:collapse;}
th{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888;padding:0 0 12px 0;border-bottom:2px solid #111;text-align:left;}
th:last-child{text-align:right;}
th:nth-child(2){text-align:center;}
.total-row td{padding-top:16px;font-size:15px;font-weight:600;color:#111;}
.footer{font-size:11px;color:#888888;text-align:center;border-top:1px solid #f0f0f0;padding-top:24px;margin-top:40px;text-transform:uppercase;letter-spacing:0.08em;}
</style></head>
<body>
<div class="container">
  <div class="logo">
    <h2 style="letter-spacing:0.2em;font-weight:600;font-size:16px;margin:0;">DEYNOLD DANNY</h2>
    <p style="font-size:9px;letter-spacing:0.15em;color:#777;margin:4px 0 0 0;">ATELIER</p>
  </div>
  <div class="title">Order Confirmed</div>
  <div class="subtitle">Order ${escapeHtml(orderNumber)}</div>
  <p style="font-size:14px;line-height:1.7;color:#555;text-align:center;margin-bottom:36px;">
    Thank you for your order. We are preparing your garments and will notify you once they are dispatched.
  </p>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Price</th>
      </tr>
    </thead>
    <tbody>
      ${buildOrderItemsRows(items)}
      <tr class="total-row">
        <td colspan="2">Total</td>
        <td style="text-align:right;">${escapeHtml(totalFormatted)}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">&copy; 2026 DEYNOLD DANNY. ALL RIGHTS RESERVED.</div>
</div>
</body></html>`;
}

export async function sendOrderConfirmedEmail(
  resendApiKey: string,
  to: string,
  orderNumber: string,
  totalFormatted: string,
  items: OrderEmailItem[],
  fromAddress?: string,
): Promise<boolean> {
  return sendEmail(
    to,
    `Your DEYNOLD DANNY Order ${orderNumber} is Confirmed`,
    buildOrderConfirmedHtml(orderNumber, totalFormatted, items),
    resendApiKey,
    fromAddress,
  );
}

export async function sendOrderShippedEmail(
  resendApiKey: string,
  to: string,
  orderNumber: string,
  courierPartner: string,
  trackingNumber: string,
  fromAddress?: string,
): Promise<boolean> {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:40px;background:#faf9f6;font-family:sans-serif;color:#111;">
  <div style="max-width:540px;margin:0 auto;background:#fff;border:1px solid #eaeaea;padding:40px;text-align:center;">
    <h2 style="letter-spacing:0.2em;font-size:16px;">DEYNOLD DANNY</h2>
    <h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;">Your Order is on its Way</h1>
    <p>Order <strong>${escapeHtml(orderNumber)}</strong> has been dispatched via <strong>${escapeHtml(courierPartner)}</strong>.</p>
    <p style="font-family:monospace;font-size:16px;border:1px solid #eaeaea;padding:16px;">Tracking Number: ${escapeHtml(trackingNumber)}</p>
    <p style="font-size:12px;color:#777;">Please allow up to 24 hours for live courier scans.</p>
  </div>
</body></html>`;
  return sendEmail(
    to,
    `Your DEYNOLD DANNY Order ${orderNumber} has been Dispatched`,
    html,
    resendApiKey,
    fromAddress,
  );
}

export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  preferredContact: 'email' | 'phone' | 'whatsapp';
}

export async function sendContactAdminEmail(
  resendApiKey: string,
  adminEmail: string,
  form: ContactFormData,
  fromAddress?: string,
): Promise<boolean> {
  const escapedMsg = escapeHtml(form.message).replace(/\n/g, '<br>');
  const phoneRow = form.phone
    ? `<p><strong>Phone:</strong> ${escapeHtml(form.phone)}</p>`
    : '';
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:32px;background:#faf9f6;font-family:sans-serif;color:#111;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #eaeaea;padding:36px;">
    <h2 style="letter-spacing:0.15em;font-size:15px;">DEYNOLD DANNY — NEW ENQUIRY</h2>
    <p><strong>Name:</strong> ${escapeHtml(form.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(form.email)}</p>
    ${phoneRow}
    <p><strong>Preferred Contact:</strong> ${escapeHtml(form.preferredContact)}</p>
    <p><strong>Subject:</strong> ${escapeHtml(form.subject)}</p>
    <div style="background:#faf9f6;border:1px solid #eaeaea;padding:16px;">${escapedMsg}</div>
  </div>
</body></html>`;

  return sendEmail(
    adminEmail,
    `New Enquiry: ${form.subject} — ${form.name}`,
    html,
    resendApiKey,
    fromAddress,
  );
}

export async function sendOrderDeliveredEmail(
  resendApiKey: string,
  to: string,
  orderNumber: string,
  fromAddress?: string,
): Promise<boolean> {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:40px;background:#faf9f6;font-family:sans-serif;color:#111;">
  <div style="max-width:540px;margin:0 auto;background:#fff;border:1px solid #eaeaea;padding:40px;text-align:center;">
    <h2 style="letter-spacing:0.2em;font-size:16px;">DEYNOLD DANNY</h2>
    <h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;">Your Order Has Arrived</h1>
    <p>Order <strong>${escapeHtml(orderNumber)}</strong> has been delivered. For client care, contact concierge@deynolddanny.com.</p>
  </div>
</body></html>`;
  return sendEmail(
    to,
    `Your DEYNOLD DANNY Order ${orderNumber} Has Been Delivered`,
    html,
    resendApiKey,
    fromAddress,
  );
}

export async function sendOrderCancelledEmail(
  resendApiKey: string,
  to: string,
  orderNumber: string,
  reason: string,
  fromAddress?: string,
): Promise<boolean> {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:40px;background:#faf9f6;font-family:sans-serif;color:#111;">
  <div style="max-width:540px;margin:0 auto;background:#fff;border:1px solid #eaeaea;padding:40px;text-align:center;">
    <h2 style="letter-spacing:0.2em;font-size:16px;">DEYNOLD DANNY</h2>
    <h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;">Order Cancelled</h1>
    <p>Order <strong>${escapeHtml(orderNumber)}</strong> has been cancelled (${escapeHtml(reason)}).</p>
  </div>
</body></html>`;
  return sendEmail(
    to,
    `Your DEYNOLD DANNY Order ${orderNumber} Has Been Cancelled`,
    html,
    resendApiKey,
    fromAddress,
  );
}

export async function sendRefundProcessedEmail(
  resendApiKey: string,
  to: string,
  orderNumber: string,
  amountFormatted: string,
  fromAddress?: string,
): Promise<boolean> {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:40px;background:#faf9f6;font-family:sans-serif;color:#111;">
  <div style="max-width:540px;margin:0 auto;background:#fff;border:1px solid #eaeaea;padding:40px;text-align:center;">
    <h2 style="letter-spacing:0.2em;font-size:16px;">DEYNOLD DANNY</h2>
    <h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;">Refund Initiated</h1>
    <p>A refund of <strong>${escapeHtml(amountFormatted)}</strong> for order <strong>${escapeHtml(orderNumber)}</strong> has been initiated to your original payment method.</p>
  </div>
</body></html>`;
  return sendEmail(
    to,
    `Refund Update for DEYNOLD DANNY Order ${orderNumber}`,
    html,
    resendApiKey,
    fromAddress,
  );
}

/**
 * Safely interpolates {{var}} tokens with HTML escaping for email templates.
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, string | number | undefined | null>,
  escapeValues = true,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const raw = variables[key] ?? '';
    return escapeValues ? escapeHtml(raw) : String(raw);
  });
}

export async function renderDbEmailTemplate(
  db: D1Database,
  templateKey: string,
  variables: Record<string, string | number | undefined | null>,
): Promise<{ subject: string; html: string } | null> {
  const row = await db
    .prepare(
      `SELECT subject_template, html_template, is_active FROM email_templates WHERE template_key = ?1 LIMIT 1`,
    )
    .bind(templateKey)
    .first<{ subject_template: string; html_template: string; is_active: number }>();

  if (!row || row.is_active !== 1) return null;
  return {
    subject: interpolateTemplate(row.subject_template, variables, false),
    html: interpolateTemplate(row.html_template, variables, true),
  };
}

export async function sendConfiguredEmail(
  resendApiKey: string,
  to: string,
  subject: string,
  html: string,
  fromAddress?: string,
): Promise<boolean> {
  return sendEmail(to, subject, html, resendApiKey, fromAddress);
}
