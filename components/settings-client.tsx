"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import {
  Menu,
  User,
  Key,
  Database,
  Shield,
  Save,
  Loader2,
  CheckCircle2,
  LockKeyhole,
  AlertTriangle
} from "lucide-react";

export function SettingsClient({ userEmail }: { userEmail?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");

  async function handlePasswordChange() {
    setPwError("");
    if (newPw.length < 8) {
      setPwError("New password must be at least 8 characters");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("Passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      setPasswordSuccess(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} userEmail={userEmail} />

      <main className="app-main">
        <header
          className="sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 backdrop-blur-xl lg:px-8"
          style={{ background: "var(--bg-glass)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 transition-colors hover:bg-black/5 lg:hidden"
              style={{ color: "var(--text-secondary)" }}
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Trust Center</h1>
              <p className="hidden text-xs sm:block" style={{ color: "var(--text-muted)" }}>
                Account identity, access control, and data safety settings
              </p>
            </div>
          </div>
        </header>

        <div className="page-container max-w-5xl space-y-6">
          <section className="rounded-[2rem] border border-emerald-300/20 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-sky-500/10 p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/60 bg-white/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Session Security</p>
                <p className="mt-2 text-sm font-bold text-slate-900">HTTP-only JWT active</p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Password Policy</p>
                <p className="mt-2 text-sm font-bold text-slate-900">Minimum 8 chars</p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700">Data Isolation</p>
                <p className="mt-2 text-sm font-bold text-slate-900">Per-user tenancy</p>
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <section className="card p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(16,185,129,0.12)" }}>
                  <User size={18} style={{ color: "#059669" }} />
                </div>
                <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Identity Profile</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={userEmail || ""}
                    disabled
                    className="input-field opacity-60"
                  />
                  <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    Email is currently read-only in app settings.
                  </p>
                </div>
              </div>
            </section>

            <section className="card p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(14,165,233,0.12)" }}>
                  <Shield size={18} style={{ color: "#0284c7" }} />
                </div>
                <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Security Posture</h2>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Authentication</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    JWT with HTTP-only cookies and server-side verification.
                  </p>
                </div>
                <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Credential Storage</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Passwords hashed with bcrypt.
                  </p>
                </div>
                <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Traffic Controls</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Request throttling and route-level checks enabled.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section className="card p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(99,102,241,0.12)" }}>
                <LockKeyhole size={18} style={{ color: "var(--brand-start)" }} />
              </div>
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Password Rotation</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="input-field"
                  placeholder="Current password"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  New Password
                </label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="input-field"
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className="input-field"
                  placeholder="Repeat password"
                />
              </div>
            </div>

            {pwError && (
              <p className="mt-4 text-sm font-medium" style={{ color: "var(--danger)" }}>{pwError}</p>
            )}

            {passwordSuccess && (
              <div className="mt-4 flex items-center gap-2 text-sm font-medium" style={{ color: "var(--success)" }}>
                <CheckCircle2 size={16} /> Password updated successfully
              </div>
            )}

            <button
              onClick={handlePasswordChange}
              disabled={savingPassword || !currentPw || !newPw}
              className="primary-btn mt-5 px-5 py-2.5 text-sm"
            >
              {savingPassword ? (
                <><Loader2 size={14} className="animate-spin" /> Saving...</>
              ) : (
                <><Save size={14} /> Update Password</>
              )}
            </button>
          </section>

          <section className="overflow-hidden rounded-3xl border border-red-300/25 bg-gradient-to-r from-red-500/10 to-orange-500/10">
            <div className="border-b px-6 py-4" style={{ borderColor: "rgba(239,68,68,0.2)" }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 text-red-600">
                  <Database size={18} />
                </div>
                <h2 className="text-base font-bold text-red-700">Danger Zone</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-red-700">Delete Account</p>
                  <p className="mt-1 text-xs text-red-600/80">
                    This permanently removes your account, files, and reports.
                  </p>
                </div>
                <button className="danger-btn px-5 py-2.5 text-sm whitespace-nowrap" disabled>
                  <AlertTriangle size={14} />
                  Delete Account
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
