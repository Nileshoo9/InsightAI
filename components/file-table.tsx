"use client";

import { useState, useMemo } from "react";
import {
  FileSpreadsheet,
  Search,
  Trash2,
  Eye,
  Sparkles,
  ChevronUp,
  ChevronDown
} from "lucide-react";

type FileItem = {
  id: string;
  fileName: string;
  uploadedAt: string;
  rawRowCount?: number;
};

type Props = {
  files: FileItem[];
  selectedFileId: string;
  onSelect: (id: string) => void;
  onPreview: (id: string) => void;
  onAnalyze: (id: string) => void;
  onDelete: (id: string) => void;
};

type SortKey = "fileName" | "uploadedAt";
type SortDir = "asc" | "desc";

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function FileTable({
  files,
  selectedFileId,
  onSelect,
  onPreview,
  onAnalyze,
  onDelete
}: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("uploadedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    let list = files;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.fileName.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [files, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  if (!files.length) {
    return (
      <div className="card p-8 text-center">
        <FileSpreadsheet size={36} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          No files uploaded yet
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Upload a CSV or Excel file to get started
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Search bar */}
      <div className="border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8">
                <span className="sr-only">Select</span>
              </th>
              <th>
                <button
                  onClick={() => toggleSort("fileName")}
                  className="inline-flex items-center gap-1"
                >
                  File Name <SortIcon col="fileName" />
                </button>
              </th>
              <th className="hidden sm:table-cell">Rows</th>
              <th>
                <button
                  onClick={() => toggleSort("uploadedAt")}
                  className="inline-flex items-center gap-1"
                >
                  Uploaded <SortIcon col="uploadedAt" />
                </button>
              </th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr
                key={f.id}
                className={selectedFileId === f.id ? "!bg-brand-500/5" : ""}
              >
                <td>
                  <input
                    type="radio"
                    name="selectedFile"
                    checked={selectedFileId === f.id}
                    onChange={() => onSelect(f.id)}
                    className="h-4 w-4 accent-brand-600 cursor-pointer"
                  />
                </td>
                <td>
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet size={16} style={{ color: "var(--brand-start)" }} />
                    <span className="truncate font-medium max-w-[200px]" style={{ color: "var(--text-primary)" }}>
                      {f.fileName}
                    </span>
                  </div>
                </td>
                <td className="hidden sm:table-cell">
                  <span className="badge badge-brand">
                    {f.rawRowCount?.toLocaleString() ?? "—"}
                  </span>
                </td>
                <td className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {formatDate(f.uploadedAt)}
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onPreview(f.id)}
                      title="Preview data"
                      className="rounded-lg p-1.5 transition-colors hover:bg-brand-500/10"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={() => onAnalyze(f.id)}
                      title="Generate insight"
                      className="rounded-lg p-1.5 transition-colors hover:bg-brand-500/10"
                      style={{ color: "var(--brand-start)" }}
                    >
                      <Sparkles size={15} />
                    </button>
                    <button
                      onClick={() => onDelete(f.id)}
                      title="Delete file"
                      className="rounded-lg p-1.5 transition-colors hover:bg-red-50"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Filter result count */}
      {search && (
        <div className="border-t px-4 py-2" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Showing {filtered.length} of {files.length} files
          </p>
        </div>
      )}
    </div>
  );
}
