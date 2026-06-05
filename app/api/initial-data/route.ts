import { apiFailure, apiSuccess, resolveActorEmailFromRequest } from "@/app/lib/api-response";
import { getInitialData } from "@/app/lib/sheets/service";

export async function GET(request: Request) {
  try {
    const actorEmail = await resolveActorEmailFromRequest(request);
    return apiSuccess(await getInitialData(actorEmail));
  } catch (error) {
    return apiFailure(error);
  }
}
