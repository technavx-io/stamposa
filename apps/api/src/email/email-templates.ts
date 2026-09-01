/**
 * HTML email templates for Stamposa's transactional mail.
 *
 * Email HTML is not web HTML. It has to survive Gmail, Outlook (which renders
 * with Word's engine), Apple Mail and a long tail of mobile clients — so the
 * rules here are deliberate, not old-fashioned:
 *
 *   - Layout is tables, not flexbox/grid. Outlook ignores the latter.
 *   - Every style is inline. Most clients strip <style> in <head>, and Gmail
 *     strips classes. The <style> block we do include is progressive
 *     enhancement (dark mode) that safely degrades when ignored.
 *   - No external assets. Remote images are blocked by default, so the logo is
 *     drawn with a coloured table cell rather than an <img> that shows a broken
 *     icon to most recipients on first open.
 *   - A hidden preheader controls the inbox preview line.
 *
 * Every HTML email ships with a matching plain-text part (build*Text). Some
 * clients show it, spam filters weigh its presence, and it is the accessible
 * fallback.
 */

const BRAND = '#4f46e5'; // indigo-600, the app's brand-600
const INK = '#0f172a'; // slate-900
const BODY = '#475569'; // slate-600
const MUTED = '#94a3b8'; // slate-400
const LINE = '#e2e8f0'; // slate-200
const CANVAS = '#f1f5f9'; // slate-100 page background
const CARD = '#ffffff';
const CODE_BG = '#eef2ff'; // brand-50

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The shared shell: page background, centred 600px card, Stamposa header and a
 * footer. `bodyHtml` is the inner content, already trusted HTML built by the
 * callers below — never raw user input.
 */
function layout(params: { preheader: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Stamposa</title>
<style>
  /* Progressive enhancement only — clients that ignore this still render the
     inline light theme correctly. */
  @media (prefers-color-scheme: dark) {
    .sp-canvas { background:#0b1220 !important; }
    .sp-card { background:#0f172a !important; }
    .sp-ink { color:#f1f5f9 !important; }
    .sp-body { color:#cbd5e1 !important; }
    .sp-code { background:#1e1b4b !important; color:#c7d2fe !important; }
    .sp-line { border-color:#1e293b !important; }
  }
  a { color:${BRAND}; }
</style>
</head>
<body class="sp-canvas" style="margin:0;padding:0;background:${CANVAS};">
  <!-- preheader: shown as the inbox preview, hidden in the body -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
    params.preheader,
  )}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">
          <!-- header -->
          <tr>
            <td style="padding:4px 4px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${BRAND};border-radius:8px;width:34px;height:34px;text-align:center;vertical-align:middle;font-family:${FONT};font-size:17px;font-weight:700;color:#ffffff;">S</td>
                  <td style="padding-left:10px;font-family:${FONT};font-size:18px;font-weight:700;letter-spacing:-0.02em;color:${INK};" class="sp-ink">Stamposa</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- card -->
          <tr>
            <td class="sp-card sp-line" style="background:${CARD};border:1px solid ${LINE};border-radius:14px;padding:36px 36px 32px;">
              ${params.bodyHtml}
            </td>
          </tr>
          <!-- footer -->
          <tr>
            <td style="padding:22px 8px 8px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};" class="sp-body">
              You received this email because someone used this address to sign in to or create a Stamposa account.
              If that wasn't you, no action is needed — the code above is useless without this inbox.
              <br><br>
              Stamposa — digital loyalty cards for caf&eacute;s, salons and shops.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface VerificationEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * A one-time verification / sign-in code email.
 *
 * @param code       the 6-digit code
 * @param expiresMin how long it stays valid, in minutes
 * @param purpose    'signup' softens the greeting for a first-time merchant;
 *                   'signin' is the returning-customer wording.
 */
export function verificationCodeEmail(params: {
  code: string;
  expiresMin: number;
  purpose: 'signup' | 'signin';
}): VerificationEmail {
  const { code, expiresMin, purpose } = params;
  const safeCode = escapeHtml(code);

  const heading = purpose === 'signup' ? 'Confirm your email' : 'Your sign-in code';
  const intro =
    purpose === 'signup'
      ? 'Welcome to Stamposa. Enter this code to confirm your email and finish setting up your account.'
      : 'Enter this code to sign in to your Stamposa account.';

  const bodyHtml = `
    <h1 style="margin:0 0 10px;font-family:${FONT};font-size:22px;line-height:28px;font-weight:700;letter-spacing:-0.02em;color:${INK};" class="sp-ink">${heading}</h1>
    <p style="margin:0 0 26px;font-family:${FONT};font-size:15px;line-height:23px;color:${BODY};" class="sp-body">${intro}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td class="sp-code" align="center" style="background:${CODE_BG};border-radius:12px;padding:22px 12px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;line-height:1;font-weight:700;letter-spacing:10px;color:${BRAND};">${safeCode}</td>
      </tr>
    </table>
    <p style="margin:22px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};" class="sp-body">
      This code expires in ${expiresMin} minutes and can be used once. Never share it — Stamposa staff will never ask you for it.
    </p>`;

  return {
    subject: `${code} is your Stamposa ${purpose === 'signup' ? 'verification' : 'sign-in'} code`,
    html: layout({
      preheader: `Your Stamposa code is ${code}. It expires in ${expiresMin} minutes.`,
      bodyHtml,
    }),
    text: [
      heading,
      '',
      intro,
      '',
      `Code: ${code}`,
      `This code expires in ${expiresMin} minutes and can be used once.`,
      '',
      "Never share this code. If you didn't request it, you can ignore this email.",
      '',
      'Stamposa — digital loyalty cards for cafés, salons and shops.',
    ].join('\n'),
  };
}
