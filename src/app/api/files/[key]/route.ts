import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getSessionFromRequest } from "@/lib/auth";
import { error, notFound, serverError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

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

    const basePath = process.env.STORAGE_LOCAL_PATH || "./storage/uploads";
    const filePath = path.join(basePath, params.key);

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(filePath);
    } catch {
      return notFound("File");
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `inline; filename="${doc.title}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
