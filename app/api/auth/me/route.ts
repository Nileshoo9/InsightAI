import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { fail, ok } from "@/lib/http";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return fail("Unauthorized", 401);
  return ok({ user: session });
}
