import 'server-only';
import { PRODUCT_NAME } from '@/components/brand-mark';
import { ROLE_LABELS, type MemberRole } from '@/lib/auth/types';

/** Company and person names are user input: never put them in HTML unescaped. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export function invitationEmail(input: {
  companyName: string;
  inviterName: string;
  role: MemberRole;
  acceptUrl: string;
  loginUrl: string;
}) {
  const company = singleLine(input.companyName);
  const inviter = singleLine(input.inviterName);
  const role = ROLE_LABELS[input.role].toLowerCase();

  const subject = `${inviter} te invitó a ${company}`;

  const text = [
    `${inviter} te invitó a unirte a ${company} en ${PRODUCT_NAME} como ${role}.`,
    '',
    `Creá tu cuenta con este email para aceptar la invitación:`,
    input.acceptUrl,
    '',
    `Si ya tenés cuenta, ingresá y vas a ver la empresa: ${input.loginUrl}`,
    '',
    'Si no esperabas esta invitación, podés ignorar este email.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f4f4f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f201c;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f1;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px;">
            <tr>
              <td style="font-size:13px;font-weight:600;color:#5c5e52;padding-bottom:24px;">${escapeHtml(PRODUCT_NAME)}</td>
            </tr>
            <tr>
              <td style="font-size:20px;line-height:28px;font-weight:600;padding-bottom:12px;">
                ${escapeHtml(inviter)} te invitó a ${escapeHtml(company)}
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;line-height:22px;color:#4a4b43;padding-bottom:24px;">
                Vas a unirte como ${escapeHtml(role)}. Creá tu cuenta con este email para aceptar la invitación.
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <a href="${escapeHtml(input.acceptUrl)}" style="display:inline-block;background:#9aa83a;color:#1c2208;font-size:14px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:8px;">Aceptar invitación</a>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:20px;color:#6b6c63;">
                ¿Ya tenés cuenta? <a href="${escapeHtml(input.loginUrl)}" style="color:#1f201c;">Ingresá</a> y vas a ver la empresa.<br />
                Si no esperabas esta invitación, podés ignorar este email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
