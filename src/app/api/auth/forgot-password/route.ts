import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email)
      return NextResponse.json({ error: "Email required" }, { status: 400 });

    // Always return 200 to prevent user enumeration
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // TODO: generate password reset token, store in DB, send email via nodemailer
      // This is a stub — in production wire up the email service here
      console.log(`[Password Reset] Token would be sent to: ${email}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
