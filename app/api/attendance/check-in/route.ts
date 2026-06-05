import { apiHandler, readJsonBody, resolveActorEmail } from "@/app/lib/api-response";
import { checkIn } from "@/app/lib/sheets/service";

export const POST = apiHandler(async (request) => {
  const body = await readJsonBody(request);
  const actorEmail = await resolveActorEmail(body, request);
  return checkIn(actorEmail, String(body.registrationId ?? ""));
});
