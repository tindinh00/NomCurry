import { apiHandler, readJsonBody, resolveActorEmail } from "@/app/lib/api-response";
import { updateHourlyRate } from "@/app/lib/sheets/service";

export const POST = apiHandler(async (request) => {
  const body = await readJsonBody(request);
  const actorEmail = await resolveActorEmail(body, request);
  return updateHourlyRate(actorEmail, String(body.employeeId ?? ""), Number(body.hourlyRate));
});
