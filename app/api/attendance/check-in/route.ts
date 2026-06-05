import { apiFailure, apiSuccess, resolveActorEmail } from "@/app/lib/api-response";
import { checkIn } from "@/app/lib/sheets/service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const actorEmail = await resolveActorEmail(body, request);
    return apiSuccess(await checkIn(actorEmail, body.registrationId));
  } catch (error) {
    return apiFailure(error);
  }
}
