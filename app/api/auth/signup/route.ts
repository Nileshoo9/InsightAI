import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validation";
import { fail, ok } from "@/lib/http";
import { hashPassword, signToken } from "@/lib/auth";
import { AUTH_COOKIE } from "@/lib/constants";
import { isDatabaseUnavailableError } from "@/lib/db-errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) return fail("Invalid signup data", 400);

    const { email, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail("Email already registered", 409);

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed
      }
    });

    const token = await signToken({ userId: user.id, email: user.email });
    const response = ok({ user: { id: user.id, email: user.email } }, 201);
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

    return fail("Failed to sign up", 500);
  }
}
