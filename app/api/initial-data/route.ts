import { apiHandler, resolveActorEmailFromRequest } from "@/app/lib/api-response";
import { getInitialData } from "@/app/lib/sheets/service";

export const GET = apiHandler(async (request) => {
  const actorEmail = await resolveActorEmailFromRequest(request);
  return getInitialData(actorEmail);
});
