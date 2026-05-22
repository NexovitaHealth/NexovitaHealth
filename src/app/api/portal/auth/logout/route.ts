import { success } from "@/lib/api-response";
import {
  clearPortalSessionCookie,
  clearPortalSessionOnResponse,
} from "@/lib/portal-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  clearPortalSessionCookie();
  const response = success({ loggedOut: true });
  return clearPortalSessionOnResponse(response);
}
