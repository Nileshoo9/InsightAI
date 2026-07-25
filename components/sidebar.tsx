"use client";

import { usePathname, useRouter } from "next/navigation";
import { fetchJson } from "@/lib/client-api";
import {
  LayoutDashboard,
  FileUp,
  BarChart3,
  Settings,
  LogOut,
  X,
  ChevronLeft
} from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  userEmail?: string;
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar({ open, onClose, userEmail }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetchJson("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Overlay (mobile) */}
      <div
        className={`sidebar-overlay ${open ? "visible" : ""}`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside className={`app-sidebar ${open ? "open" : ""}`}>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-base font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                AI Analyst
              </span>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 lg:hidden"
              style={{ color: "var(--text-muted)" }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1 space-y-1 px-3 pt-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <button
                  key={href}
                  suppressHydrationWarning
                  onClick={() => {
                    router.push(href);
                    onClose();
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? "bg-brand-500/10 text-brand-600"
                      : "hover:bg-black/[0.03]"
                  }`}
                  style={active ? {} : { color: "var(--text-secondary)" }}
                >
                  <Icon size={18} />
                  {label}
                  {active && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t px-4 py-4" style={{ borderColor: "var(--border)" }}>
            {userEmail && (
              <div className="mb-3 truncate px-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                {userEmail}
              </div>
            )}
            <button
              onClick={handleLogout}
              suppressHydrationWarning
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-red-50"
              style={{ color: "var(--danger)" }}
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
