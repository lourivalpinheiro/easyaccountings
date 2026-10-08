import "server-only";
import nodemailer from "nodemailer";

export async function sendMail(to: string, subject: string, html: string, text: string) {
  if (!process.env.SMTP_HOST) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP não configurado.");
    }
    console.info(`\n[mail:dev] Para: ${to}\nAssunto: ${subject}\n${text}\n`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, html, text });
}
