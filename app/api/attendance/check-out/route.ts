import { apiHandler, readJsonBody, resolveActorEmail } from "@/app/lib/api-response";
import { checkOut } from "@/app/lib/sheets/service";

export const POST = apiHandler(async (request) => {
  const body = await readJsonBody(request);
  const actorEmail = await resolveActorEmail(body, request);
  return checkOut(actorEmail, String(body.registrationId ?? ""), typeof body.note === "string" ? body.note : "");
});
