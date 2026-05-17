import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { success, unauthorized } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();

  const { user } = session;
  return success({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    preferredLanguage: user.preferredLanguage,
    country: user.country,
    orgMemberships: user.orgMemberships.map(
      (m: {
        orgId: string;
        role: string;
        isPrimary: boolean;
        org: { id: string; name: string; slug: string };
      }) => ({
        orgId: m.orgId,
        role: m.role,
        isPrimary: m.isPrimary,
        org: m.org,
      }),
    ),
  });
}
