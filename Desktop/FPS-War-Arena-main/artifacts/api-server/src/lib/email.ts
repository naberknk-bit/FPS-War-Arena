import { logger } from "./logger";

const SENDER_NAME = "Tactical Shooter";
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendVerificationEmail(
  toEmail: string,
  toName: string,
  code: string
): Promise<boolean> {
  const apiKey = process.env["BREVO_API_KEY"];
  if (!apiKey) {
    logger.error("BREVO_API_KEY is not set");
    return false;
  }

  const SENDER_EMAIL = process.env["BREVO_SENDER_EMAIL"] ?? "";
  if (!SENDER_EMAIL) {
    logger.error("BREVO_SENDER_EMAIL is not set");
    return false;
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin:0; padding:0; background:#0a0a0a; font-family:'Courier New',monospace; }
    .wrap { max-width:480px; margin:40px auto; background:#111; border:1px solid #2a0a0a; border-radius:8px; overflow:hidden; }
    .header { background:#ff4655; padding:24px 32px; }
    .header h1 { margin:0; color:#fff; font-size:1.4rem; letter-spacing:0.3em; text-transform:uppercase; }
    .body { padding:32px; }
    .code-box { background:#1a0505; border:2px solid #ff4655; border-radius:6px; padding:20px; text-align:center; margin:24px 0; }
    .code { font-size:2.8rem; font-weight:900; color:#ff4655; letter-spacing:0.5em; }
    .note { font-size:0.75rem; color:#666; margin-top:8px; }
    p { color:#aaa; font-size:0.85rem; line-height:1.6; }
    .footer { border-top:1px solid #222; padding:16px 32px; font-size:0.7rem; color:#444; text-align:center; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header"><h1>🎮 Tactical Shooter</h1></div>
    <div class="body">
      <p>Merhaba <strong style="color:#fff">${toName}</strong>,</p>
      <p>Hesabını doğrulamak için aşağıdaki 6 haneli kodu kullan:</p>
      <div class="code-box">
        <div class="code">${code}</div>
        <div class="note">Bu kod 15 dakika geçerlidir.</div>
      </div>
      <p>Eğer bu isteği sen yapmadıysan bu e-postayı görmezden gelebilirsin.</p>
    </div>
    <div class="footer">Tactical Shooter — Browser FPS &bull; Bu e-posta otomatik gönderilmiştir.</div>
  </div>
</body>
</html>`;

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: toEmail, name: toName }],
        subject: `[Tactical Shooter] Doğrulama Kodun: ${code}`,
        htmlContent,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error({ status: response.status, body: errText }, "Brevo API error");
      return false;
    }

    logger.info({ to: toEmail }, "Verification email sent via Brevo");
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to send verification email");
    return false;
  }
}
