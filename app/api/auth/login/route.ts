import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { fail, ok } from "@/lib/http";
import { signToken, verifyPassword } from "@/lib/auth";
import { AUTH_COOKIE } from "@/lib/constants";
import { isDatabaseUnavailableError } from "@/lib/db-errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return fail("Invalid login data", 400);

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail("Invalid credentials", 401);

    const valid = await verifyPassword(password, user.password);
    if (!valid) return fail("Invalid credentials", 401);

    const token = await signToken({ userId: user.id, email: user.email });
    const response = ok({ user: { id: user.id, email: user.email } });
    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });
    return response;
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return fail("Database is temporarily unavailable. Please try again shortly.", 503);
    }

    return fail("Failed to login", 500);
  }
}
