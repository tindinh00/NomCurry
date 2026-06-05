import { apiFailure, apiSuccess, resolveActorEmail } from "@/app/lib/api-response";
import { addWeeklyRegistrations } from "@/app/lib/sheets/service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const actorEmail = await resolveActorEmail(body, request);
    return apiSuccess(await addWeeklyRegistrations(actorEmail, body.monday ?? "", body.slots ?? [], body.note ?? ""));
  } catch (error) {
    return apiFailure(error);
  }
}
