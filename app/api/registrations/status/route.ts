import { apiHandler, readJsonBody, resolveActorEmail } from "@/app/lib/api-response";
import { updateRegistrationStatus } from "@/app/lib/sheets/service";

export const POST = apiHandler(async (request) => {
  const body = await readJsonBody(request);
  const actorEmail = await resolveActorEmail(body, request);
  return updateRegistrationStatus(actorEmail, String(body.registrationId ?? ""), String(body.status ?? ""));
});
