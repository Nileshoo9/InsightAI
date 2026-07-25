import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { SettingsClient } from "@/components/settings-client";

export const metadata = {
  title: "Settings"
};

export default async function SettingsPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  return <SettingsClient userEmail={session.email} />;
}
