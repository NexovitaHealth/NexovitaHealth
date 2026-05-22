import { NextRequest } from "next/server";
import { withOrgAccess } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";
import { error, forbidden, serverError, success } from "@/lib/api-response";
import {
  getPatientCareTeamContacts,
  isFieldStaffRole,
  userOnPatientCareTeam,
} from "@/lib/message-scope";

export const dynamic = "force-dynamic";

export const GET = withOrgAccess(
  async (req: NextRequest, _ctx, auth) => {
    try {
      const patientId = req.nextUrl.searchParams.get("patientId")?.trim();
      if (!patientId) {
        return error("patientId is required", 422, {
          patientId: ["patientId is required"],
        });
      }

      const patient = await prisma.patient.findFirst({
        where: {
          id: patientId,
          orgId: auth.orgId!,
          deletedAt: null,
        },
        select: { id: true, fullName: true },
      });

      if (!patient) return error("Patient is not available in this org", 404);

      if (isFieldStaffRole(auth.user.role)) {
        const onTeam = await userOnPatientCareTeam(auth.userId, patientId);
        if (!onTeam) {
          return forbidden(
            "You can only message care teams for your assigned patients",
          );
        }
      }

      const contacts = await getPatientCareTeamContacts(
        patientId,
        auth.orgId!,
        auth.userId,
      );

      return success({
        patient,
        contacts,
      });
    } catch (err) {
      return serverError(err);
    }
  },
  { permission: "message:send" },
);
