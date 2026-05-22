import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const FROM = process.env.EMAIL_FROM || 'Nexovita Health <noreply@nexovita.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

async function sendMail(options: {
  to: string
  subject: string
  html: string
}) {
  if (!hasSmtpConfig()) {
    console.warn(`[Email] SMTP is not configured; skipped email to ${options.to}`)
    return
  }

  await transporter.sendMail({
    from: FROM,
    ...options,
  })
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`

  await sendMail({
    to: email,
    subject: 'Reset your Nexovita Health password',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a5276;">Password Reset Request</h2>
        <p>You requested a password reset for your Nexovita Health account.</p>
        <p>Click the link below to set a new password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="
          display: inline-block;
          background: #1a5276;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          margin: 16px 0;
        ">Reset Password</a>
        <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">Nexovita Health · HIPAA-compliant care management platform</p>
      </div>
    `,
  })
}

export async function sendInvitationEmail(params: {
  email: string
  inviterName: string
  agencyName: string
  role: string
  token: string
}): Promise<void> {
  const acceptUrl = `${APP_URL}/invite/${params.token}`

  await sendMail({
    to: params.email,
    subject: `You've been invited to join ${params.agencyName} on Nexovita Health`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a5276;">You're invited!</h2>
        <p><strong>${params.inviterName}</strong> has invited you to join <strong>${params.agencyName}</strong> on Nexovita Health as a <strong>${params.role.replace('_', ' ')}</strong>.</p>
        <a href="${acceptUrl}" style="
          display: inline-block;
          background: #1a5276;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          margin: 16px 0;
        ">Accept Invitation</a>
        <p style="color: #666; font-size: 14px;">This invitation expires in 7 days.</p>
      </div>
    `,
  })
}

export async function sendEmailVerification(email: string, token: string): Promise<void> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`

  await sendMail({
    to: email,
    subject: 'Verify your Nexovita Health email',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a5276;">Welcome to Nexovita Health</h2>
        <p>Please verify your email address to complete your registration.</p>
        <a href="${verifyUrl}" style="
          display: inline-block;
          background: #1a5276;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          margin: 16px 0;
        ">Verify Email</a>
      </div>
    `,
  })
}

export async function sendPortalAccessEmail(params: {
  email: string
  recipientName: string
  patientName: string
  portalLabel: string
  token: string
}): Promise<void> {
  const loginUrl = `${APP_URL}/portal/login?token=${encodeURIComponent(params.token)}`

  await sendMail({
    to: params.email,
    subject: `Your ${params.portalLabel} access for ${params.patientName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a5276;">Portal access ready</h2>
        <p>Hello ${params.recipientName},</p>
        <p>You now have read-only ${params.portalLabel} access for <strong>${params.patientName}</strong>.</p>
        <p>Use the secure link below to sign in. This link is single-use and expires in 7 days.</p>
        <a href="${loginUrl}" style="
          display: inline-block;
          background: #028090;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          margin: 16px 0;
        ">Open Portal</a>
        <p style="color: #666; font-size: 14px;">If you did not expect this email, contact your care agency.</p>
      </div>
    `,
  })
}

export async function sendCriticalAlertEmail(params: {
  email: string
  recipientName: string
  patientName: string
  alertTitle: string
  alertBody: string
  actionUrl: string
}): Promise<void> {
  await sendMail({
    to: params.email,
    subject: `Critical patient alert: ${params.patientName}`,
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
          border-radius: 6px;
          text-decoration: none;
          margin: 16px 0;
        ">Open Patient Chart</a>
        <p style="color: #666; font-size: 14px;">This message does not include the full chart. Sign in to Nexovita to review details.</p>
      </div>
    `,
  })
}
