/**
 * Email Queue Consumer — Cloudflare Queue Handler
 *
 * Processes batches of EmailJob items dispatched to the deynold-danny-emails queue.
 * Handles three email types: otp, order_confirmed, order_shipped.
 *
 * Message retry: Cloudflare Queues automatically retries failed messages.
 * We ack all messages individually to avoid partial-batch retries.
 */

import type { Env } from '../types/bindings.js';
import type { EmailJob } from '../types/api.js';
import { sendOtpEmail, sendOrderConfirmedEmail, sendOrderShippedEmail, type OrderEmailItem } from '../services/resend.js';

export async function processEmailQueue(
  batch: MessageBatch<EmailJob>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    const job = message.body;

    try {
      if (job.type === 'otp') {
        await sendOtpEmail(env.RESEND_API_KEY, job.to, job.otp);
      } else if (job.type === 'order_confirmed') {
        const emailItems: OrderEmailItem[] = job.items.map((item) => ({
          title: item.title,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }));
        await sendOrderConfirmedEmail(
          env.RESEND_API_KEY,
          job.to,
          job.orderNumber,
          job.totalFormatted,
          emailItems,
        );
      } else if (job.type === 'order_shipped') {
        await sendOrderShippedEmail(
          env.RESEND_API_KEY,
          job.to,
          job.orderNumber,
          job.courierPartner,
          job.trackingNumber,
        );
      }

      // Explicitly acknowledge each message on success
      message.ack();
    } catch (err) {
      console.error(`[EmailQueue] Failed to send ${job.type} email to ${job.to}:`, err);
      // Retry the message — Cloudflare will re-deliver it after the retry delay
      message.retry();
    }
  }
}

