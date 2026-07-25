"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/client-api";
import { Sidebar } from "@/components/sidebar";
import { StatsCard } from "@/components/stats-card";
import { UploadZone } from "@/components/upload-zone";
import { FileTable } from "@/components/file-table";
import { DataPreviewModal } from "@/components/data-preview-modal";
import {
  Menu,
  FileStack,
  Database,
  BarChart3,
  Clock,
  Sparkles,
  Loader2,
  ArrowRight,
  Activity,
  Wand2
} from "lucide-react";

type FileItem = {
  id: string;
  fileName: string;
  uploadedAt: string;
  rawRowCount?: number;
};

type InsightItem = {
  id: string;
  fileId: string;
  createdAt: string;
  file: { fileName: string };
};

type Stats = {
  fileCount: number;
  insightCount: number;
  recordCount: number;
  lastUpload: string | null;
  lastAnalysis: string | null;
};

const PROMPT_PRESETS = [
  "Find revenue drivers and conversion leaks by category",
  "Detect anomalies and outlier periods with root-cause hints",
  "Summarize retention or repeat behavior patterns",
  "Build an executive summary for leadership review",
  "Identify optimization opportunities and quantify impact"
];

export function DashboardClient({ userEmail }: { userEmail?: string }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedFileId, setSelectedFileId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [analysisPrompt, setAnalysisPrompt] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [fileRes, insightRes, statsRes] = await Promise.all([
        fetchJson<{ files: FileItem[] }>("/api/files"),
        fetchJson<{ insights: InsightItem[] }>("/api/insights"),
        fetchJson<Stats>("/api/stats")
      ]);
      setFiles(fileRes.files || []);
      setInsights(insightRes.insights || []);
      setStats(statsRes || null);
      if (fileRes.files?.length && !selectedFileId) {
        setSelectedFileId(fileRes.files[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }, [selectedFileId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setSuccess(`Uploaded ${file.name} - ${data.rawRowCount.toLocaleString()} rows parsed.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleAnalyze(fileId?: string, prompt?: string) {
    const id = fileId || selectedFileId;
    if (!id) {
      setError("Select a file first");
      return;
    }
    setAnalyzing(true);
    setError("");
    setSuccess("");
    try {
      const result = await fetchJson<{ insightId: string }>("/api/analyze", {
        method: "POST",
        body: JSON.stringify({ fileId: id, prompt })
      });
      setSuccess("Analysis complete. Opening your report...");
      setTimeout(() => router.push(`/insights/${result.insightId}`), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDeleteFile(id: string) {
    if (!confirm("Delete this file and all associated data?")) return;
    try {
      await fetchJson(`/api/files/${id}`, { method: "DELETE" });
      setSuccess("File deleted.");
      if (selectedFileId === id) setSelectedFileId("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function formatRelative(value: string | null) {
    if (!value) return "Never";
    const diff = Date.now() - new Date(value).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="app-layout">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userEmail={userEmail}
      />

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
              <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                Mission Control
              </h1>
              <p className="hidden text-xs sm:block" style={{ color: "var(--text-muted)" }}>
                Upload, model, and ship decisions from your data
              </p>
            </div>
          </div>

          <button
            onClick={() => setPromptModalOpen(true)}
            disabled={!selectedFileId || analyzing}
            className="primary-btn px-5 py-2.5 text-sm"
          >
            {analyzing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Wand2 size={16} />
                <span className="hidden sm:inline">Run Strategic Analysis</span>
                <span className="sm:hidden">Analyze</span>
              </>
            )}
          </button>
        </header>

        <div className="page-container space-y-6">
          <section className="relative overflow-hidden rounded-[2rem] border border-sky-300/20 bg-gradient-to-r from-sky-500/10 via-cyan-500/10 to-emerald-500/5 p-6 shadow-xl">
            <div className="absolute -top-12 right-8 h-32 w-32 rounded-full bg-sky-400/20 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-cyan-400/20 blur-2xl" />
            <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-white/40 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-700">
                  <Activity size={12} />
                  Analysis Pipeline
                </div>
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl" style={{ color: "var(--text-primary)" }}>
                  Build sharper reports with goal-driven AI analysis
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Select a file, set your objective, and generate an insight report with trends, risks, opportunities, and export-ready executive output.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/60 bg-white/70 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Files</p>
                  <p className="mt-2 text-xl font-black text-slate-900">{stats?.fileCount ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-white/60 bg-white/70 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Reports</p>
                  <p className="mt-2 text-xl font-black text-slate-900">{stats?.insightCount ?? 0}</p>
                </div>
                <div className="col-span-2 rounded-2xl border border-white/60 bg-white/70 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-700">Last Analysis</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatRelative(stats?.lastAnalysis ?? null)}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              label="Total Files"
              value={stats?.fileCount ?? 0}
              icon={FileStack}
              color="brand"
              delay={0}
            />
            <StatsCard
              label="Data Records"
              value={stats?.recordCount ?? 0}
              icon={Database}
              color="cyan"
              delay={100}
            />
            <StatsCard
              label="Insights Generated"
              value={stats?.insightCount ?? 0}
              icon={BarChart3}
              color="emerald"
              delay={200}
            />
            <StatsCard
              label="Last Upload"
              value={0}
              icon={Clock}
              color="amber"
              delay={300}
              suffix={formatRelative(stats?.lastUpload ?? null)}
              prefix=""
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
            <div className="space-y-6">
              <UploadZone uploading={uploading} onUpload={handleUpload} />
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Dataset Inventory
                </h2>
                <FileTable
                  files={files}
                  selectedFileId={selectedFileId}
                  onSelect={setSelectedFileId}
                  onPreview={(id) => setPreviewFileId(id)}
                  onAnalyze={handleAnalyze}
                  onDelete={handleDeleteFile}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Recent Reports
                </h3>
                {insights?.length ? (
                  <div className="space-y-2">
                    {insights.slice(0, 6).map((i) => (
                      <button
                        key={i.id}
                        onClick={() => router.push(`/insights/${i.id}`)}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-brand-500/5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium" style={{ color: "var(--text-primary)" }}>
                            {i.file?.fileName || "Deleted File"}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {formatRelative(i.createdAt)}
                          </p>
                        </div>
                        <ArrowRight size={14} style={{ color: "var(--text-muted)" }} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    No reports yet. Upload data and run your first analysis.
                  </p>
                )}
              </div>

              <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 p-5">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                  Suggested Analysis Goals
                </h3>
                <div className="mt-3 space-y-2">
                  {PROMPT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        setAnalysisPrompt(preset);
                        setPromptModalOpen(true);
                      }}
                      className="w-full rounded-xl border border-white/50 bg-white/60 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-white"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {error && <div className="toast toast-error">{error}</div>}
        {success && <div className="toast toast-success">{success}</div>}
      </main>

      {previewFileId && (
        <DataPreviewModal
          fileId={previewFileId}
          onClose={() => setPreviewFileId(null)}
        />
      )}

      {promptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md p-6 shadow-2xl animate-slide-up">
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              Analysis Objective
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Describe the decision you want this report to support. The model will adapt its insight structure to this objective.
            </p>
            <textarea
              className="input-field mt-4 w-full resize-none"
              rows={3}
              placeholder="e.g. Which segments are declining and what actions should leadership take next quarter?"
              value={analysisPrompt}
              onChange={(e) => setAnalysisPrompt(e.target.value)}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              {PROMPT_PRESETS.map((s) => (
                <button
                  key={s}
                  onClick={() => setAnalysisPrompt(s)}
                  className="px-3 py-1.5 text-[11px] rounded-xl border border-brand-500/20 bg-brand-500/5 hover:bg-brand-500/10 text-brand-500 transition-all font-bold tracking-tight"
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={() => {
                  setPromptModalOpen(false);
                  handleAnalyze(undefined, analysisPrompt);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-brand-500 py-4 text-sm font-black text-white shadow-xl shadow-brand-500/20 transition-all hover:bg-brand-400 active:scale-[0.98]"
              >
                <Sparkles size={18} />
                Generate Strategic Report
              </button>
              <button
                onClick={() => setPromptModalOpen(false)}
                className="w-full rounded-2xl bg-neutral-900 border border-white/5 py-3 text-sm font-bold text-neutral-400 transition-all hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
