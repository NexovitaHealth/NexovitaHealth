import { NextRequest } from "next/server";
import { z } from "zod";
import { withOrgAccess } from "@/lib/middleware";
import { error, serverError, success, validationError } from "@/lib/api-response";
import { testClearinghouseConnection } from "@/lib/clearinghouse";

export const dynamic = "force-dynamic";

const testSchema = z.object({
  transport: z.enum(["sftp", "http"]),
});

export const POST = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
    try {
      const body = await req.json().catch(() => ({}));
      const parsed = testSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error);

      const result = await testClearinghouseConnection(
        auth.orgId!,
        parsed.data.transport,
      );
      return success(result);
    } catch (err) {
      if (err instanceof Error) {
        return error(err.message, 422);
      }
      return serverError(err);
    }
  },
  { permission: "billing:manage" },
);
