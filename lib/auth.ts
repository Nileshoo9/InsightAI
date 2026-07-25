import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/constants";

const encoder = new TextEncoder();
const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";

type SessionToken = {
  userId: string;
  email: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signToken(payload: SessionToken) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encoder.encode(jwtSecret));
}

export async function verifyToken(token: string): Promise<SessionToken | null> {
  try {
    const { payload } = await jwtVerify(token, encoder.encode(jwtSecret));
    if (typeof payload.userId !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email
    };
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getSessionFromCookies() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}
