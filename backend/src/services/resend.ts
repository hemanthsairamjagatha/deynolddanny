// Resend transactional email service for DEYNOLD DANNY

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'DEYNOLD DANNY <noreply@deynolddanny.com>';

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  resendApiKey: string,
): Promise<void> {
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }
}

// ---------------------------------------------------------------------------
// OTP email
// ---------------------------------------------------------------------------

function buildOtpHtml(otp: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<style>
body{margin:0;padding:0;background-color:#faf9f6;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;color:#111111;}
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
    <p style="font-size:9px;letter-spacing:0.15em;color:#777;margin:4px 0 0 0;">MILANO &bull; ATELIER</p>
  </div>
  <div class="title">Verification Code</div>
  <p class="text">Please enter the security verification code below to access your client account and sartorial wardrobe.</p>
  <div class="code-box">${otp}</div>
  <p class="text" style="font-size:12px;color:#888;">This code remains active for 10 minutes. If you did not request this, you may safely ignore this correspondence.</p>
  <div class="footer">&copy; 2026 DEYNOLD DANNY S.R.L. ALL RIGHTS RESERVED.</div>
</div>
</body></html>`;
}

/**
 * Sends a luxury OTP verification email via Resend.
 * @param resendApiKey - Resend API key (first param for consistency)
 */
export async function sendOtpEmail(
  resendApiKey: string,
  to: string,
  otp: string,
): Promise<void> {
  const html = buildOtpHtml(otp);
  await sendEmail(to, 'Your DEYNOLD DANNY Verification Code', html, resendApiKey);
}

// ---------------------------------------------------------------------------
// Order confirmed email
// ---------------------------------------------------------------------------

// Accepts the ApiOrderItem shape (superset of old OrderEmailItem)
export interface OrderEmailItem {
  title: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: string;  // pre-formatted, e.g. "₹ 12,500.00"
  // Allow extra fields (ApiOrderItem is a superset)
  [key: string]: unknown;
}

function buildOrderItemsRows(items: OrderEmailItem[]): string {
  return items
    .map(
      item => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;">
          ${item.title}<br>
          <span style="font-size:11px;color:#888;">${item.color} / ${item.size}</span>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;text-align:center;">${item.quantity}</td>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;text-align:right;">${item.unitPrice}</td>
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
body{margin:0;padding:0;background-color:#faf9f6;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;color:#111111;}
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
    <p style="font-size:9px;letter-spacing:0.15em;color:#777;margin:4px 0 0 0;">MILANO &bull; ATELIER</p>
  </div>
  <div class="title">Order Confirmed</div>
  <div class="subtitle">Order ${orderNumber}</div>
  <p style="font-size:14px;line-height:1.7;color:#555;text-align:center;margin-bottom:36px;">
    Thank you for your order. We are preparing your garments with the utmost care and will notify you once they are dispatched.
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
        <td style="text-align:right;">${totalFormatted}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">&copy; 2026 DEYNOLD DANNY S.R.L. ALL RIGHTS RESERVED.</div>
</div>
</body></html>`;
}

/**
 * Sends an order confirmation email with line-item breakdown.
 * @param resendApiKey - Resend API key (first param for consistency)
 */
export async function sendOrderConfirmedEmail(
  resendApiKey: string,
  to: string,
  orderNumber: string,
  totalFormatted: string,
  items: OrderEmailItem[],
): Promise<void> {
  const html = buildOrderConfirmedHtml(orderNumber, totalFormatted, items);
  await sendEmail(
    to,
    `Your DEYNOLD DANNY Order ${orderNumber} is Confirmed`,
    html,
    resendApiKey,
  );
}

// ---------------------------------------------------------------------------
// Order shipped email
// ---------------------------------------------------------------------------

function buildOrderShippedHtml(
  orderNumber: string,
  courierPartner: string,
  trackingNumber: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<style>
body{margin:0;padding:0;background-color:#faf9f6;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;color:#111111;}
.container{max-width:540px;margin:40px auto;background-color:#ffffff;border:1px solid #eaeaea;padding:48px;}
.logo{text-align:center;margin-bottom:36px;}
.title{font-family:Georgia,serif;font-size:22px;font-weight:400;text-align:center;letter-spacing:0.04em;margin-bottom:16px;color:#111111;}
.text{font-size:14px;line-height:1.7;color:#555555;text-align:center;margin-bottom:28px;}
.tracking-box{border:1px solid #eaeaea;padding:24px;margin-bottom:32px;text-align:center;}
.tracking-label{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:8px;}
.tracking-value{font-size:16px;font-weight:600;color:#111;letter-spacing:0.04em;}
.courier{font-size:12px;color:#888;margin-top:4px;}
.footer{font-size:11px;color:#888888;text-align:center;border-top:1px solid #f0f0f0;padding-top:24px;text-transform:uppercase;letter-spacing:0.08em;}
</style></head>
<body>
<div class="container">
  <div class="logo">
    <h2 style="letter-spacing:0.2em;font-weight:600;font-size:16px;margin:0;">DEYNOLD DANNY</h2>
    <p style="font-size:9px;letter-spacing:0.15em;color:#777;margin:4px 0 0 0;">MILANO &bull; ATELIER</p>
  </div>
  <div class="title">Your Order is on its Way</div>
  <p class="text">
    Your order <strong>${orderNumber}</strong> has been dispatched and is en route to you. Please find your tracking details below.
  </p>
  <div class="tracking-box">
    <div class="tracking-label">Tracking Number</div>
    <div class="tracking-value">${trackingNumber}</div>
    <div class="courier">${courierPartner}</div>
  </div>
  <p class="text" style="font-size:12px;color:#888;">
    Please allow 24 hours for tracking information to become active on the courier's portal.
  </p>
  <div class="footer">&copy; 2026 DEYNOLD DANNY S.R.L. ALL RIGHTS RESERVED.</div>
</div>
</body></html>`;
}

/**
 * Sends a shipment dispatch notification with tracking details.
 * @param resendApiKey - Resend API key (first param for consistency)
 */
export async function sendOrderShippedEmail(
  resendApiKey: string,
  to: string,
  orderNumber: string,
  courierPartner: string,
  trackingNumber: string,
): Promise<void> {
  const html = buildOrderShippedHtml(orderNumber, courierPartner, trackingNumber);
  await sendEmail(
    to,
    `Your DEYNOLD DANNY Order ${orderNumber} has been Dispatched`,
    html,
    resendApiKey,
  );
}


// ---------------------------------------------------------------------------
// Contact form notification email (sent to admin)
// ---------------------------------------------------------------------------

export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  preferredContact: 'email' | 'phone' | 'whatsapp';
}

function buildContactAdminHtml(form: ContactFormData): string {
  const phoneRow = form.phone
    ? `<div class="field"><div class="label">Phone</div><div class="value">${form.phone}</div></div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<style>
body{margin:0;padding:0;background-color:#faf9f6;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;color:#111111;}
.container{max-width:600px;margin:40px auto;background-color:#ffffff;border:1px solid #eaeaea;padding:48px;}
.logo{text-align:center;margin-bottom:36px;}
.title{font-family:Georgia,serif;font-size:20px;font-weight:400;text-align:center;letter-spacing:0.04em;margin-bottom:28px;color:#111111;}
.field{margin-bottom:16px;}
.label{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:4px;}
.value{font-size:14px;color:#111;line-height:1.6;}
.message-box{background:#faf9f6;border:1px solid #eaeaea;padding:16px;font-size:14px;line-height:1.7;color:#333;}
.footer{font-size:11px;color:#888888;text-align:center;border-top:1px solid #f0f0f0;padding-top:24px;margin-top:40px;text-transform:uppercase;letter-spacing:0.08em;}
</style></head>
<body>
<div class="container">
  <div class="logo">
    <h2 style="letter-spacing:0.2em;font-weight:600;font-size:16px;margin:0;">DEYNOLD DANNY</h2>
    <p style="font-size:9px;letter-spacing:0.15em;color:#777;margin:4px 0 0 0;">MILANO &bull; ATELIER</p>
  </div>
  <div class="title">New Client Enquiry</div>
  <div class="field"><div class="label">Name</div><div class="value">${form.name}</div></div>
  <div class="field"><div class="label">Email</div><div class="value"><a href="mailto:${form.email}" style="color:#111;">${form.email}</a></div></div>
  ${phoneRow}
  <div class="field"><div class="label">Preferred Contact</div><div class="value" style="text-transform:capitalize;">${form.preferredContact}</div></div>
  <div class="field"><div class="label">Subject</div><div class="value">${form.subject}</div></div>
  <div class="field"><div class="label">Message</div><div class="message-box">${form.message.replace(/\n/g, '<br>')}</div></div>
  <div class="footer">&copy; 2026 DEYNOLD DANNY S.R.L. ALL RIGHTS RESERVED.</div>
</div>
</body></html>`;
}

/**
 * Sends a contact form enquiry notification to the admin.
 */
export async function sendContactAdminEmail(
  resendApiKey: string,
  adminEmail: string,
  form: ContactFormData,
): Promise<void> {
  const html = buildContactAdminHtml(form);
  await sendEmail(
    adminEmail,
    `New Enquiry: ${form.subject} — ${form.name}`,
    html,
    resendApiKey,
  );
}

// ---------------------------------------------------------------------------
// Order delivered notification email
// ---------------------------------------------------------------------------

function buildOrderDeliveredHtml(orderNumber: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
<style>
body{margin:0;padding:0;background-color:#faf9f6;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;color:#111111;}
.container{max-width:540px;margin:40px auto;background-color:#ffffff;border:1px solid #eaeaea;padding:48px;}
.logo{text-align:center;margin-bottom:36px;}
.title{font-family:Georgia,serif;font-size:22px;font-weight:400;text-align:center;letter-spacing:0.04em;margin-bottom:16px;color:#111111;}
.text{font-size:14px;line-height:1.7;color:#555555;text-align:center;margin-bottom:28px;}
.check{font-size:40px;text-align:center;margin-bottom:20px;color:#111;}
.footer{font-size:11px;color:#888888;text-align:center;border-top:1px solid #f0f0f0;padding-top:24px;text-transform:uppercase;letter-spacing:0.08em;}
</style></head>
<body>
<div class="container">
  <div class="logo">
    <h2 style="letter-spacing:0.2em;font-weight:600;font-size:16px;margin:0;">DEYNOLD DANNY</h2>
    <p style="font-size:9px;letter-spacing:0.15em;color:#777;margin:4px 0 0 0;">MILANO &bull; ATELIER</p>
  </div>
  <div class="check">&#10003;</div>
  <div class="title">Your Order Has Arrived</div>
  <p class="text">
    Your order <strong>${orderNumber}</strong> has been successfully delivered.
    We hope your garments bring you great satisfaction and elegance.
  </p>
  <p class="text" style="font-size:12px;color:#888;">
    If you have any concerns about your delivery, please contact our client concierge at
    <a href="mailto:concierge@deynolddanny.com" style="color:#111;">concierge@deynolddanny.com</a>
  </p>
  <div class="footer">&copy; 2026 DEYNOLD DANNY S.R.L. ALL RIGHTS RESERVED.</div>
</div>
</body></html>`;
}

/**
 * Sends a delivery confirmation email to the customer.
 */
export async function sendOrderDeliveredEmail(
  resendApiKey: string,
  to: string,
  orderNumber: string,
): Promise<void> {
  const html = buildOrderDeliveredHtml(orderNumber);
  await sendEmail(
    to,
    `Your DEYNOLD DANNY Order ${orderNumber} Has Been Delivered`,
    html,
    resendApiKey,
  );
}
