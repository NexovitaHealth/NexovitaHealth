import { NextRequest } from "next/server";
import { error, serverError, success } from "@/lib/api-response";
import { getInvitationPreview } from "@/lib/invitations";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const preview = await getInvitationPreview(params.token);
    if ("error" in preview && preview.error) {
      const messages: Record<string, { msg: string; status: number }> = {
        INVITE_NOT_FOUND: { msg: "Invitation not found", status: 404 },
        INVITE_NOT_PENDING: { msg: "This invitation is no longer valid", status: 410 },
        INVITE_EXPIRED: { msg: "This invitation has expired", status: 410 },
      };
      const mapped = messages[preview.error];
      return error(mapped.msg, mapped.status);
    }
    return success(preview.invitation);
  } catch (err) {
    return serverError(err);
  }
}
