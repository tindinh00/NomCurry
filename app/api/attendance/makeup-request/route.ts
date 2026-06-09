import { apiHandler, readJsonBody, resolveActorEmail } from "@/app/lib/api-response";
import { requestMakeupAttendance } from "@/app/lib/sheets/service";

export const POST = apiHandler(async (request) => {
  const body = await readJsonBody(request);
  const actorEmail = await resolveActorEmail(body, request);
  return requestMakeupAttendance(
    actorEmail,
    String(body.registrationId ?? ""),
    String(body.proposedCheckIn ?? ""),
    String(body.proposedCheckOut ?? ""),
    typeof body.reason === "string" ? body.reason : ""
  );
});
