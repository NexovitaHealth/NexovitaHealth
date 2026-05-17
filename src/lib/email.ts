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

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`

  await transporter.sendMail({
    from: FROM,
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
  const acceptUrl = `${APP_URL}/invitations/${params.token}/accept`

  await transporter.sendMail({
    from: FROM,
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

  await transporter.sendMail({
    from: FROM,
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
