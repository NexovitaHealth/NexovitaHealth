import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  created,
  error,
  notFound,
  serverError,
  success,
  validationError,
} from "@/lib/api-response";
import { withOrgAccess } from "@/lib/middleware";
import { getOrgPatientOrThrow } from "@/lib/visits";
import { storage, UploadValidationError } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(async (_req: NextRequest, ctx, auth) => {
  try {
    await getOrgPatientOrThrow(auth.orgId!, ctx.params.patientId);

    const documents = await prisma.patientDocument.findMany({
      where: {
        patientId: ctx.params.patientId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    return success(documents);
  } catch (err) {
    if (err instanceof Error && err.message === "PATIENT_NOT_FOUND") {
      return notFound("Patient");
    }
    return serverError(err);
  }
});

export const POST = withOrgAccess(async (req: NextRequest, ctx, auth) => {
  try {
    await getOrgPatientOrThrow(auth.orgId!, ctx.params.patientId);

    const formData = await req.formData();
    const file = formData.get("file");
    const title = (formData.get("title") as string) || "Document";
    const documentType =
      (formData.get("documentType") as string) || "clinical";

    if (!(file instanceof File)) {
      return error("A file is required", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let stored;
    try {
      stored = await storage.upload(buffer, file.name, file.type);
    } catch (err) {
      if (err instanceof UploadValidationError) {
        return error(err.message, 400);
      }
      throw err;
    }

    const document = await prisma.patientDocument.create({
      data: {
        patientId: ctx.params.patientId,
        uploadedById: auth.userId,
        title,
        documentType,
        fileUrl: stored.url,
        fileKey: stored.key,
        mimeType: stored.mimeType,
        sizeBytes: stored.size,
      },
    });

    await createAuditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      action: "created",
      resourceType: "patient_document",
      resourceId: document.id,
      patientId: ctx.params.patientId,
      metadata: { documentType, title },
      req,
    });

    return created(document);
  } catch (err) {
    if (err instanceof Error && err.message === "PATIENT_NOT_FOUND") {
      return notFound("Patient");
    }
    return serverError(err);
  }
});
