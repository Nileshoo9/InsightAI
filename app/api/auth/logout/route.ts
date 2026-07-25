import { ok } from "@/lib/http";
import { AUTH_COOKIE } from "@/lib/constants";

export async function POST() {
  const response = ok({ success: true });
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}
