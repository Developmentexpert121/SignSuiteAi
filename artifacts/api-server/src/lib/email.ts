import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

export interface WelcomeEmailParams {
  toEmail: string;
  toName: string;
  username: string;
  tempPassword: string;
  loginUrl: string;
  /** "welcome" (default) for new accounts, "reset" for password resets */
  kind?: "welcome" | "reset";
  /** ISO timestamp the password was updated (used for reset emails) */
  updatedAt?: string;
}

function getTransport(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    logger.warn(
      { hasHost: !!host, hasUser: !!user, hasPass: !!pass },
      "SMTP not fully configured — welcome emails will only be logged"
    );
    return null;
  }

  logger.info({ host, port, user }, "Building SMTP transport for send");
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
  });
}

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
  const isReset = params.kind === "reset";
  const updatedAtStr = (() => {
    if (!params.updatedAt) return new Date().toUTCString();
    const d = new Date(params.updatedAt);
    return Number.isNaN(d.getTime()) ? params.updatedAt : d.toUTCString();
  })();

  const subject = isReset
    ? "SignSuiteIQ — Your Password Has Been Updated"
    : "Welcome to SignSuiteIQ — Your Admin Account is Ready";

  const introLine = isReset
    ? `Your SignSuiteIQ password was updated on ${updatedAtStr}.`
    : `An admin account has been created for you on SignSuiteIQ.`;

  const passwordLabel = isReset ? "New password" : "Temporary password";
  const footerNote = isReset
    ? `If you did not request this change, please contact your administrator immediately.`
    : `Please change your password after your first login.`;

  const text = [
    `Hi ${params.toName},`,
    ``,
    introLine,
    ``,
    `  Username:        ${params.username}`,
    `  Email:           ${params.toEmail}`,
    `  ${passwordLabel}: ${params.tempPassword}`,
    ...(isReset ? [`  Updated at:      ${updatedAtStr}`] : []),
    ``,
    `Sign in here: ${params.loginUrl}`,
    ``,
    footerNote,
    ``,
    `— The SignSuiteIQ Team`,
  ].join("\n");

  const heading = isReset ? "Your password was updated" : "Welcome to SignSuiteIQ";

  const html = `
    <div style="font-family:-apple-system,BlogSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#ea580c;margin:0 0 16px">${heading}</h2>
      <p>Hi ${escapeHtml(params.toName)},</p>
      <p>${escapeHtml(introLine)}</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 12px 6px 0;color:#6b7280">Username</td><td style="padding:6px 0;font-family:monospace">${escapeHtml(params.username)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#6b7280">Email</td><td style="padding:6px 0;font-family:monospace">${escapeHtml(params.toEmail)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#6b7280">${escapeHtml(passwordLabel)}</td><td style="padding:6px 0;font-family:monospace;font-weight:600">${escapeHtml(params.tempPassword)}</td></tr>
        ${isReset ? `<tr><td style="padding:6px 12px 6px 0;color:#6b7280">Updated at</td><td style="padding:6px 0;font-family:monospace">${escapeHtml(updatedAtStr)}</td></tr>` : ""}
      </table>
      <p>
        <a href="${params.loginUrl}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600">Sign in</a>
      </p>
      <p style="color:#6b7280;font-size:13px">${escapeHtml(footerNote)}</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">— The SignSuiteIQ Team</p>
    </div>
  `;

  const transport = getTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@signsuiteiq.ai";

  if (transport) {
    try {
      const info = await transport.sendMail({
        from,
        to: params.toEmail,
        subject,
        text,
        html,
      });
      logger.info({ to: params.toEmail, messageId: info.messageId }, "Welcome email sent");
      return;
    } catch (err) {
      logger.error({ err, to: params.toEmail }, "Welcome email send failed — falling back to log");
    }
  }

  // Fallback: log to console so the temp password is still visible
  logger.info({ to: params.toEmail, subject }, "Welcome email (logged only)");
  // eslint-disable-next-line no-console
  console.log(
    "\n" +
      "─".repeat(70) + "\n" +
      `✉  WELCOME EMAIL → ${params.toEmail}\n` +
      "─".repeat(70) + "\n" +
      `Subject: ${subject}\n\n${text}\n` +
      "─".repeat(70) + "\n"
  );
}

export interface AccountInviteEmailParams {
  toEmail: string;
  toName: string;
  username: string;
  setupUrl: string;
  /** Lifetime of the link in hours (used for the body copy). */
  expiresInHours: number;
}

/**
 * Email sent when an admin creates an account (or resends the welcome). The
 * recipient clicks "Set your password" to choose their own password — no
 * password ever appears in the email.
 */
export async function sendAccountInviteEmail(
  params: AccountInviteEmailParams,
): Promise<void> {
  const subject = "Welcome to SignSuiteIQ — Set your password";
  const intro =
    `An admin account has been created for you on SignSuiteIQ. ` +
    `Click the button below to choose your password and sign in.`;
  const linkNote = `This link expires in ${params.expiresInHours} hours and can be used only once.`;

  const text = [
    `Hi ${params.toName},`,
    ``,
    intro,
    ``,
    `  Username: ${params.username}`,
    `  Email:    ${params.toEmail}`,
    ``,
    `Set your password:`,
    params.setupUrl,
    ``,
    linkNote,
    ``,
    `— The SignSuiteIQ Team`,
  ].join("\n");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#ea580c;margin:0 0 16px">Welcome to SignSuiteIQ</h2>
      <p>Hi ${escapeHtml(params.toName)},</p>
      <p>${escapeHtml(intro)}</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 12px 6px 0;color:#6b7280">Username</td><td style="padding:6px 0;font-family:monospace">${escapeHtml(params.username)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#6b7280">Email</td><td style="padding:6px 0;font-family:monospace">${escapeHtml(params.toEmail)}</td></tr>
      </table>
      <p style="margin:24px 0">
        <a href="${params.setupUrl}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Set your password</a>
      </p>
      <p style="color:#6b7280;font-size:13px">
        Or paste this link into your browser:<br>
        <span style="font-family:monospace;word-break:break-all">${escapeHtml(params.setupUrl)}</span>
      </p>
      <p style="color:#6b7280;font-size:13px">${escapeHtml(linkNote)}</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">— The SignSuiteIQ Team</p>
    </div>
  `;

  const transport = getTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@signsuiteiq.ai";

  if (transport) {
    try {
      const info = await transport.sendMail({
        from,
        to: params.toEmail,
        subject,
        text,
        html,
      });
      logger.info({ to: params.toEmail, messageId: info.messageId }, "Account-invite email sent");
      return;
    } catch (err) {
      logger.error({ err, to: params.toEmail }, "Account-invite email failed — falling back to log");
    }
  }

  logger.info({ to: params.toEmail, subject }, "Account-invite email (logged only)");
  // eslint-disable-next-line no-console
  console.log(
    "\n" +
      "─".repeat(70) + "\n" +
      `✉  ACCOUNT INVITE → ${params.toEmail}\n` +
      "─".repeat(70) + "\n" +
      `Subject: ${subject}\n\n${text}\n` +
      "─".repeat(70) + "\n"
  );
}

export interface PasswordResetLinkEmailParams {
  toEmail: string;
  toName: string;
  resetUrl: string;
  /** Lifetime of the link in minutes (used for the body copy). */
  expiresInMinutes: number;
}

/**
 * Email a *reset link* (not a temporary password). The user clicks the link,
 * lands on /reset-password?token=..., chooses their own password, and is
 * redirected to /login. The token only appears in the email URL — never in
 * the database — so leaked DB dumps cannot be used to reset accounts.
 */
export async function sendPasswordResetLinkEmail(
  params: PasswordResetLinkEmailParams,
): Promise<void> {
  const subject = "SignSuiteIQ — Reset your password";
  const intro = `We received a request to reset the password for your SignSuiteIQ account.`;
  const linkNote = `This link expires in ${params.expiresInMinutes} minutes and can be used only once.`;
  const ignoreNote = `If you did not request a password reset, you can safely ignore this email — your password will not change.`;

  const text = [
    `Hi ${params.toName},`,
    ``,
    intro,
    ``,
    `Reset your password here:`,
    params.resetUrl,
    ``,
    linkNote,
    ``,
    ignoreNote,
    ``,
    `— The SignSuiteIQ Team`,
  ].join("\n");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
      <h2 style="color:#ea580c;margin:0 0 16px">Reset your password</h2>
      <p>Hi ${escapeHtml(params.toName)},</p>
      <p>${escapeHtml(intro)}</p>
      <p style="margin:24px 0">
        <a href="${params.resetUrl}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Reset password</a>
      </p>
      <p style="color:#6b7280;font-size:13px">
        Or paste this link into your browser:<br>
        <span style="font-family:monospace;word-break:break-all">${escapeHtml(params.resetUrl)}</span>
      </p>
      <p style="color:#6b7280;font-size:13px">${escapeHtml(linkNote)}</p>
      <p style="color:#6b7280;font-size:13px">${escapeHtml(ignoreNote)}</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">— The SignSuiteIQ Team</p>
    </div>
  `;

  const transport = getTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@signsuiteiq.ai";

  if (transport) {
    try {
      const info = await transport.sendMail({
        from,
        to: params.toEmail,
        subject,
        text,
        html,
      });
      logger.info({ to: params.toEmail, messageId: info.messageId }, "Password-reset link email sent");
      return;
    } catch (err) {
      logger.error({ err, to: params.toEmail }, "Password-reset link email failed — falling back to log");
    }
  }

  logger.info({ to: params.toEmail, subject }, "Password-reset link email (logged only)");
  // eslint-disable-next-line no-console
  console.log(
    "\n" +
      "─".repeat(70) + "\n" +
      `✉  PASSWORD RESET LINK → ${params.toEmail}\n` +
      "─".repeat(70) + "\n" +
      `Subject: ${subject}\n\n${text}\n` +
      "─".repeat(70) + "\n"
  );
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
