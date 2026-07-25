import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { DashboardClient } from "@/components/dashboard-client";

export const metadata = {
  title: "Dashboard"
};

export default async function DashboardPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  return <DashboardClient userEmail={session.email} />;
}
