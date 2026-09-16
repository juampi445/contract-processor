import 'server-only';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Gmail scores a From address nobody can answer slightly worse, and a bouncing
 * reply is a bad look anyway. Optional: without it the message is unchanged.
 */
function replyTo(): string | undefined {
  return process.env.EMAIL_REPLY_TO || undefined;
}

export type SendResult = { ok: true } | { ok: false; reason: string };

/**
 * Sends a transactional email through the Resend HTTP API. The key only
 * allows sending email, so it never grants access to the database.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.error('[email] RESEND_API_KEY o EMAIL_FROM no están configurados.');
    return { ok: false, reason: 'not_configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        reply_to: replyTo(),
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[email] Resend respondió ${response.status}: ${body.slice(0, 300)}`);
      return { ok: false, reason: `http_${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    console.error('[email] No se pudo enviar:', error);
    return { ok: false, reason: 'network' };
  }
}
