import { HttpError } from "@/lib/auth/current-user";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function fail(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return Response.json({ error: "invalid_body", issues: err.issues }, { status: 400 });
  }
  console.error("[api]", err);
  return Response.json(
    { error: "internal_error", message: err instanceof Error ? err.message : String(err) },
    { status: 500 },
  );
}

export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}
