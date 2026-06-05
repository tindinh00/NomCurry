import { apiFailure, apiSuccess, resolveActorEmail } from "@/app/lib/api-response";
import { updateHourlyRate } from "@/app/lib/sheets/service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const actorEmail = await resolveActorEmail(body, request);
    return apiSuccess(await updateHourlyRate(actorEmail, body.employeeId, Number(body.hourlyRate)));
  } catch (error) {
    return apiFailure(error);
  }
}
