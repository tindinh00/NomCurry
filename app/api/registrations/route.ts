import { apiHandler, readJsonBody, resolveActorEmail } from "@/app/lib/api-response";
import { addWeeklyRegistrations } from "@/app/lib/sheets/service";

export const POST = apiHandler(async (request) => {
  const body = await readJsonBody(request);
  const actorEmail = await resolveActorEmail(body, request);
  return addWeeklyRegistrations(
    actorEmail,
    typeof body.monday === "string" ? body.monday : "",
    Array.isArray(body.slots) ? body.slots as { date: string; shiftId: string; note: string }[] : [],
    typeof body.note === "string" ? body.note : ""
  );
});
