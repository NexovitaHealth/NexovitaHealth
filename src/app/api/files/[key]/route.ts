import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { error, notFound, serverError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { key: string } },
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return error("Unauthorized", 401);

    const doc = await prisma.patientDocument.findFirst({
      where: { fileKey: params.key, deletedAt: null },
      select: { mimeType: true, title: true },
    });
    if (!doc) return notFound("File");

    const { buffer, mimeType } = await storage.read(params.key);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType ?? doc.mimeType,
        "Content-Disposition": `inline; filename="${doc.title}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("ENOENT")) {
      return notFound("File");
    }
    return serverError(err);
  }
}
