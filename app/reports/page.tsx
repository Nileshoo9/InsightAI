import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ReportsClient } from "@/components/reports-client";

export const metadata = {
  title: "Reports"
};

export default async function ReportsPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  return <ReportsClient userEmail={session.email} />;
}
