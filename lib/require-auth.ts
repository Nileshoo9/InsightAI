import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { fail } from "@/lib/http";

export async function requireAuth(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return { session: null, error: fail("Unauthorized", 401) };
  }
  return { session, error: null };
}
