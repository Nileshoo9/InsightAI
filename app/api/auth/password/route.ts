import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { requireAuth } from "@/lib/require-auth";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { passwordChangeSchema } from "@/lib/validation";
import { isDatabaseUnavailableError } from "@/lib/db-errors";

export async function PATCH(req: NextRequest) {
  try {
    const { session, error } = await requireAuth(req);
    if (error || !session) return error || fail("Unauthorized", 401);
    const parsed = passwordChangeSchema.safeParse(await req.json());
    if (!parsed.success) return fail("Password must be 8 to 72 characters", 400);

    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { password: true } });
    if (!user || !(await verifyPassword(parsed.data.currentPassword, user.password))) {
      return fail("Current password is incorrect", 401);
    }
    await prisma.user.update({ where: { id: session.userId }, data: { password: await hashPassword(parsed.data.newPassword) } });
    return ok({ message: "Password updated" });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) return fail("Database is temporarily unavailable. Please try again shortly.", 503);
    return fail("Unable to update password", 500);
  }
}
