"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import { X, Loader2, FileSpreadsheet } from "lucide-react";

type Props = {
  fileId: string;
  onClose: () => void;
};

type PreviewData = {
  fileName: string;
  rawRowCount: number;
  recordCount: number;
  preview: Record<string, unknown>[];
};

export function DataPreviewModal({ fileId, onClose }: Props) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const result = await fetchJson<PreviewData>(`/api/files/${fileId}`);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load preview");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [fileId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const columns = data?.preview?.[0] ? Object.keys(data.preview[0]) : [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={18} style={{ color: "var(--brand-start)" }} />
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                {data?.fileName || "Data Preview"}
              </h2>
              {data && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {data.rawRowCount.toLocaleString()} rows • {columns.length} columns
                  {data.preview.length < data.rawRowCount && ` • Showing first ${data.preview.length}`}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-black/5"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body p-0">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin" style={{ color: "var(--brand-start)" }} />
            </div>
          )}

          {error && (
            <div className="p-6 text-center">
              <p className="text-sm font-medium" style={{ color: "var(--danger)" }}>{error}</p>
            </div>
          )}

          {data && data.preview.length > 0 && (
            <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
              <table className="data-table">
                <thead className="sticky top-0 z-10" style={{ background: "var(--bg-secondary)" }}>
                  <tr>
                    <th className="w-10">#</th>
                    {columns.map((col) => (
                      <th key={col} className="whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.preview.map((row, idx) => (
                    <tr key={idx}>
                      <td className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                        {idx + 1}
                      </td>
                      {columns.map((col) => (
                        <td key={col} className="max-w-[200px] truncate text-sm">
                          {String(row[col] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.preview.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No preview data available
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
