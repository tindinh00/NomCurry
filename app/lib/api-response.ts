import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AppError, badRequest, unauthorized } from "@/app/lib/domain/errors";

export function apiSuccess(data: unknown) {
  return NextResponse.json({ ok: true, data });
}

export function apiFailure(error: unknown) {
  const status = error instanceof AppError ? error.status : 500;
  const code = error instanceof AppError ? error.code : "INTERNAL_ERROR";
  const message = error instanceof Error ? error.message : String(error);
  console.error("[API Error]", { status, code, message });
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export function apiHandler(handler: (request: Request) => Promise<unknown>) {
  return async (request: Request) => {
    try {
      return apiSuccess(await handler(request));
    } catch (error) {
      return apiFailure(error);
    }
  };
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw badRequest("Body JSON không hợp lệ.");
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw badRequest("Body JSON không hợp lệ.");
  }
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
    const [key, val] = cookie.trim().split("=");
    if (key) acc[key] = val ? decodeURIComponent(val) : "";
    return acc;
  }, {} as Record<string, string>);
  return cookies[name] || null;
}

/**
 * Resolves the actor email for a POST request.
 * Checks NextAuth session, cookies, request body, and falls back to NOMCURRY_DEV_ACTOR_EMAIL only in development.
 */
export async function resolveActorEmail(body: Record<string, unknown>, request: Request): Promise<string> {
  const session = await auth();
  const sessionEmail = session?.user?.email;

  const cookieEmail = getCookie(request, "nomcurry_actor_email");
  const loggedOut = getCookie(request, "nomcurry_logged_out");
  const isDev = process.env.NODE_ENV === "development";
  
  const email =
    sessionEmail ||
    cookieEmail ||
    (typeof body.actorEmail === "string" ? body.actorEmail.trim() : "") ||
    (typeof body.email === "string" ? body.email.trim() : "") ||
    (loggedOut === "true" ? "" : (isDev ? (process.env.NOMCURRY_DEV_ACTOR_EMAIL ?? "") : ""));
    
  if (!email) throw unauthorized();
  return email;
}

/**
 * Resolves actor email for a GET request (from NextAuth session, cookies, query params, or env in dev).
 */
export async function resolveActorEmailFromRequest(request: Request): Promise<string> {
  const session = await auth();
  const sessionEmail = session?.user?.email;

  const cookieEmail = getCookie(request, "nomcurry_actor_email");
  const loggedOut = getCookie(request, "nomcurry_logged_out");
  const isDev = process.env.NODE_ENV === "development";
  
  const email =
    sessionEmail ||
    cookieEmail ||
    (new URL(request.url).searchParams.get("actorEmail") ?? "").trim() ||
    (loggedOut === "true" ? "" : (isDev ? (process.env.NOMCURRY_DEV_ACTOR_EMAIL ?? "") : ""));
    
  return email || "";
}


