/**
 * Email Queue Consumer — Cloudflare Queue Handler
 */

import type { Env } from '../types/bindings.js';
import type { EmailJob } from '../types/api.js';
import {
  recordAndSendEmail,
  sendOtpEmail,
  sendOrderConfirmedEmail,
  sendOrderShippedEmail,
  type OrderEmailItem,
} from '../services/resend.js';

export async function processEmailQueue(
  batch: MessageBatch<EmailJob>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    const job = message.body;

    try {
      if (job.type === 'otp') {
        await sendOtpEmail(env.RESEND_API_KEY, job.to, job.otp, env.RESEND_FROM_EMAIL);
      } else if (job.type === 'order_confirmed') {
        const emailItems: OrderEmailItem[] = job.items.map((item) => ({
          title: item.title,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }));
        await recordAndSendEmail(
          env.DB,
          `order_confirmed:${job.orderNumber}`,
          'order_confirmed',
          job.to,
          job,
          () =>
            sendOrderConfirmedEmail(
              env.RESEND_API_KEY,
              job.to,
              job.orderNumber,
              job.totalFormatted,
              emailItems,
              env.RESEND_FROM_EMAIL,
            ),
        );
      } else if (job.type === 'order_shipped') {
        await recordAndSendEmail(
          env.DB,
          `order_shipped:${job.orderNumber}:${job.trackingNumber}`,
          'order_shipped',
          job.to,
          job,
          () =>
            sendOrderShippedEmail(
              env.RESEND_API_KEY,
              job.to,
              job.orderNumber,
              job.courierPartner,
              job.trackingNumber,
              env.RESEND_FROM_EMAIL,
            ),
        );
      }

      message.ack();
    } catch (err) {
      console.error(`[EmailQueue] Failed to process ${job.type} email:`, err);
      message.retry();
    }
  }
}
