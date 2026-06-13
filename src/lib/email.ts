import { Resend } from "resend";
import {
  createEmailDeliveryLog,
  markEmailFailed,
  markEmailSent,
  type TrackedEmailPayload,
} from "@/lib/email-delivery";
import { prisma } from "@/lib/prisma";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM =
  process.env.EMAIL_FROM || "Nexovita Health <no-reply@nexovita.health>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function deliverTrackedEmail(payload: TrackedEmailPayload) {
  const log = await createEmailDeliveryLog(payload);

  if (!hasResendConfig()) {
    console.warn(`[Email] RESEND_API_KEY is not set; skipped email to ${payload.to}`);
    await markEmailFailed(log.id, "RESEND_API_KEY not configured");
    return log;
  }

  try {
    const { data, error } = await getResend().emails.send({
      from: FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    if (error) throw new Error(error.message);
    await markEmailSent(log.id, data?.id);
    return log;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    await markEmailFailed(log.id, message);
    throw err;
  }
}

export async function retryDeliveryEmail(deliveryId: string) {
  const log = await prisma.emailDeliveryLog.findUnique({
    where: { id: deliveryId },
  });
  if (!log) throw new Error("NOT_FOUND");
  if (log.status === "bounced") throw new Error("BOUNCED");
  if (log.status === "sent") throw new Error("ALREADY_SENT");
  if (log.attempts >= log.maxAttempts) throw new Error("MAX_ATTEMPTS");

  const meta =
    log.metadata && typeof log.metadata === "object"
      ? (log.metadata as Record<string, unknown>)
      : {};
  const html = typeof meta.html === "string" ? meta.html : null;
  if (!html) throw new Error("NO_PAYLOAD");

  if (!hasResendConfig()) {
    await markEmailFailed(log.id, "RESEND_API_KEY not configured");
    throw new Error("RESEND_NOT_CONFIGURED");
  }

  try {
    const { data, error } = await getResend().emails.send({
      from: FROM,
      to: log.to,
      subject: log.subject,
      html,
    });
    if (error) throw new Error(error.message);
    return markEmailSent(log.id, data?.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    await markEmailFailed(log.id, message);
    throw err;
  }
}

async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  template: string;
  orgId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await deliverTrackedEmail({
      ...options,
      metadata: { ...options.metadata, html: options.html },
    });
  } catch {
    // Callers may not need to fail the request when email fails
  }
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  await sendMail({
    to: email,
    subject: "Reset your Nexovita Health password",
    template: "password_reset",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #028090;">Password Reset Request</h2>
        <p>You requested a password reset for your Nexovita Health account.</p>
        <p>Click the link below to set a new password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="
          display: inline-block;
          background: #028090;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          margin: 16px 0;
          font-weight: 600;
        ">Reset Password</a>
        <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">Nexovita Health · HIPAA-compliant care management platform</p>
      </div>
    `,
  });
}

export async function sendInvitationEmail(params: {
  email: string;
  inviterName: string;
  agencyName: string;
  role: string;
  token: string;
  orgId?: string;
}): Promise<void> {
  const acceptUrl = `${APP_URL}/invite/${params.token}`;

  await sendMail({
    to: params.email,
    subject: `You've been invited to join ${params.agencyName} on Nexovita Health`,
    template: "invitation",
    orgId: params.orgId,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #028090;">You're invited!</h2>
        <p><strong>${params.inviterName}</strong> has invited you to join <strong>${params.agencyName}</strong> on Nexovita Health as a <strong>${params.role.replace("_", " ")}</strong>.</p>
        <a href="${acceptUrl}" style="
          display: inline-block;
          background: #028090;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          margin: 16px 0;
          font-weight: 600;
        ">Accept Invitation</a>
        <p style="color: #666; font-size: 14px;">This invitation expires in 7 days.</p>
      </div>
    `,
  });
}

export async function sendAgencySetupEmail(params: {
  email: string;
  senderName: string;
  token: string;
}): Promise<void> {
  const setupUrl = `${APP_URL}/setup-agency?token=${params.token}`;

  await sendMail({
    to: params.email,
    subject: "You've been invited to set up an agency on Nexovita Health",
    template: "agency_invitation",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #028090;">Set up your agency on Nexovita Health</h2>
        <p><strong>${params.senderName}</strong> has invited you to create and manage your own agency on Nexovita Health.</p>
        <p>Click the button below to set up your account and agency. The link expires in 30 days.</p>
        <a href="${setupUrl}" style="
          display: inline-block;
          background: #028090;
          color: white;
          padding: 12px 28px;
          border-radius: 8px;
          text-decoration: none;
          margin: 20px 0;
          font-weight: 600;
        ">Set Up My Agency</a>
        <p style="color: #666; font-size: 13px;">Or copy this link into your browser:<br/>${setupUrl}</p>
        <p style="color: #999; font-size: 12px;">If you did not expect this invitation, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendEmailVerification(
  email: string,
  token: string,
): Promise<void> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

  await sendMail({
    to: email,
    subject: "Verify your Nexovita Health email",
    template: "email_verification",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #028090;">Welcome to Nexovita Health</h2>
        <p>Please verify your email address to complete your registration.</p>
        <a href="${verifyUrl}" style="
          display: inline-block;
          background: #028090;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          margin: 16px 0;
          font-weight: 600;
        ">Verify Email</a>
      </div>
    `,
  });
}

export async function sendPortalAccessEmail(params: {
  email: string;
  recipientName: string;
  patientName: string;
  portalLabel: string;
  token: string;
  orgId?: string;
}): Promise<void> {
  const loginUrl = `${APP_URL}/portal/login?token=${encodeURIComponent(params.token)}`;

  await sendMail({
    to: params.email,
    subject: `Your ${params.portalLabel} access for ${params.patientName}`,
    template: "portal_access",
    orgId: params.orgId,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #028090;">Portal access ready</h2>
        <p>Hello ${params.recipientName},</p>
        <p>You now have read-only ${params.portalLabel} access for <strong>${params.patientName}</strong>.</p>
        <p>Use the secure link below to sign in. This link is single-use and expires in 7 days.</p>
        <a href="${loginUrl}" style="
          display: inline-block;
          background: #028090;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          margin: 16px 0;
          font-weight: 600;
        ">Open Portal</a>
        <p style="color: #666; font-size: 14px;">If you did not expect this email, contact your care agency.</p>
      </div>
    `,
  });
}

export async function sendCriticalAlertEmail(params: {
  email: string;
  recipientName: string;
  patientName: string;
  alertTitle: string;
  alertBody: string;
  actionUrl: string;
  orgId?: string;
}): Promise<void> {
  await sendMail({
    to: params.email,
    subject: `Critical patient alert: ${params.patientName}`,
    template: "critical_alert",
    orgId: params.orgId,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #b42318;">Critical Patient Alert</h2>
        <p>Hello ${params.recipientName},</p>
        <p><strong>${params.patientName}</strong> has a critical alert that needs review.</p>
        <div style="border-left: 4px solid #b42318; padding-left: 12px; margin: 16px 0;">
          <p style="font-weight: 700; margin: 0 0 8px;">${params.alertTitle}</p>
          <p style="margin: 0;">${params.alertBody}</p>
        </div>
        <a href="${params.actionUrl}" style="
          display: inline-block;
          background: #b42318;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          margin: 16px 0;
          font-weight: 600;
        ">Open Patient Chart</a>
        <p style="color: #666; font-size: 14px;">This message does not include the full chart. Sign in to Nexovita to review details.</p>
      </div>
    `,
  });
}
