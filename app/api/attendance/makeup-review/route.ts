import { apiHandler, readJsonBody, resolveActorEmail } from "@/app/lib/api-response";
import { reviewMakeupAttendance } from "@/app/lib/sheets/service";

export const POST = apiHandler(async (request) => {
  const body = await readJsonBody(request);
  const actorEmail = await resolveActorEmail(body, request);
  return reviewMakeupAttendance(
    actorEmail,
    String(body.requestId ?? ""),
    String(body.decision ?? ""),
    typeof body.managerNote === "string" ? body.managerNote : ""
  );
});
