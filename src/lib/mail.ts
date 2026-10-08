import "server-only";
import nodemailer from "nodemailer";

/**
 * Envia e-mail pelo Resend (RESEND_API_KEY) ou por SMTP (SMTP_HOST...).
 * Não há alternativa: sem provedor configurado o envio falha, nunca imprime o conteúdo em log.
 */
export async function sendMail(to: string, subject: string, html: string, text: string) {
  const from = process.env.MAIL_FROM || process.env.SMTP_FROM;
  if (!from) throw new Error("MAIL_FROM não configurado.");

  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!res.ok) throw new Error(`Resend respondeu ${res.status}: ${await res.text()}`);
    return;
  }

  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({ from, to, subject, html, text });
    return;
  }

  throw new Error("Nenhum provedor de e-mail configurado (RESEND_API_KEY ou SMTP_HOST).");
}
