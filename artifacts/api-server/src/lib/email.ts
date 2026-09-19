import nodemailer from "nodemailer";
import { db, emailOutbox } from "@workspace/db";
import { config, smtpConfigured } from "../config";
import { logger } from "./logger";

let transporter: nodemailer.Transporter | undefined;

function getTransporter(): nodemailer.Transporter | undefined {
  if (!smtpConfigured()) return undefined;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: config.smtpUsername ? { user: config.smtpUsername, pass: config.smtpPassword } : undefined,
    });
  }
  return transporter;
}

type Mail = { to: string; subject: string; html: string; text?: string };

/**
 * Sends email when SMTP is configured; otherwise records it in the dev
 * outbox (visible at /api/admin/outbox) so the feature stays demonstrable.
 * Never throws - email failure must not break any workflow.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const t = getTransporter();
  if (!t) {
    await db.insert(emailOutbox).values({ toEmail: mail.to, subject: mail.subject, body: mail.text ?? mail.html, status: "skipped", error: "SMTP not configured (dev outbox)" }).catch(() => {});
    return;
  }
  try {
    await t.sendMail({ from: config.smtpFrom, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
    await db.insert(emailOutbox).values({ toEmail: mail.to, subject: mail.subject, body: mail.text ?? "", status: "sent" }).catch(() => {});
  } catch (error) {
    logger.warn({ error, to: mail.to }, "Email send failed");
    await db.insert(emailOutbox).values({ toEmail: mail.to, subject: mail.subject, body: mail.text ?? "", status: "failed", error: error instanceof Error ? error.message : "send failed" }).catch(() => {});
  }
}

const wrap = (title: string, body: string, cta?: { label: string; href: string }): string => `
<div style="background:#faf5f7;padding:24px;font-family:Inter,Segoe UI,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #f3e2e8">
    <div style="background:linear-gradient(135deg,#ec4899,#f472b6);padding:20px 28px;color:#fff">
      <div style="font-size:20px;font-weight:800">SmartServe</div>
      <div style="font-size:12px;opacity:.9">Your Local Service. Smarter.</div>
    </div>
    <div style="padding:28px">
      <h1 style="margin:0 0 12px;font-size:20px;color:#1c1917">${title}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#44403c">${body}</p>
      ${cta ? `<a href="${cta.href}" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">${cta.label}</a>` : ""}
    </div>
    <div style="padding:16px 28px;background:#faf5f7;font-size:12px;color:#a8a29e">SmartServe - local services marketplace. This is an automated message.</div>
  </div>
</div>`;

export const templates = {
  welcome(email: string, name: string): Mail {
    return { to: email, subject: "Welcome to SmartServe", html: wrap(`Welcome, ${name}!`, "Your account is ready. Book trusted local services with AI-assisted diagnostics, transparent estimates, live tracking and secure payments."), text: `Welcome to SmartServe, ${name}!` };
  },
  verifyEmail(email: string, token: string): Mail {
    const href = `${config.publicOrigin}/verify-email?token=${token}`;
    return { to: email, subject: "Verify your SmartServe email", html: wrap("Verify your email", "Confirm your email address to keep your account secure.", { label: "Verify email", href }), text: `Verify your email: ${href}` };
  },
  passwordReset(email: string, token: string): Mail {
    const href = `${config.publicOrigin}/reset-password?token=${token}`;
    return { to: email, subject: "Reset your SmartServe password", html: wrap("Reset your password", "We received a request to reset your password. This link expires in 30 minutes. If you did not request this, ignore this email.", { label: "Reset password", href }), text: `Reset your password: ${href}` };
  },
  bookingConfirmed(email: string, serviceName: string, providerName: string, at: string): Mail {
    return { to: email, subject: "Your service request was accepted", html: wrap("Provider accepted your request", `${providerName} has accepted your ${serviceName} request (${at}). Track them live from your dashboard and chat when they are on the way.`) };
  },
  serviceCompleted(email: string, serviceName: string): Mail {
    return { to: email, subject: "Service completed", html: wrap("Service completed", `Your ${serviceName} service is marked complete. Confirm and pay from your dashboard to close the booking and activate your service warranty.`) };
  },
  paymentConfirmed(email: string, amount: string, txn: string): Mail {
    return { to: email, subject: "Payment received", html: wrap("Payment confirmed", `We received your payment of ${amount}. Transaction ID: ${txn}. Thank you for using SmartServe!`) };
  },
  disputeUpdate(email: string, status: string, note: string): Mail {
    return { to: email, subject: "Dispute update", html: wrap("Dispute update", `Your dispute is now: ${status}. ${note}`) };
  },
  providerNewRequest(email: string, customerName: string, serviceName: string, area: string): Mail {
    return { to: email, subject: "New service request nearby", html: wrap("New service request", `${customerName} requested ${serviceName} in ${area}. Open your provider dashboard to accept the request before it expires.`) };
  },
};
