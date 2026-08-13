"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2 } from "lucide-react";

type Props = {
  uploading: boolean;
  onUpload: (file: File) => void;
};

export function UploadZone({ uploading, onUpload }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onUpload(file);
    },
    [onUpload]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onUpload(file);
      e.target.value = "";
    },
    [onUpload]
  );

  return (
    <div
      className={`upload-zone ${dragOver ? "drag-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xls,.xlsx"
        onChange={handleChange}
        className="hidden"
        disabled={uploading}
      />

      <div className="space-y-3">
        {uploading ? (
          <>
            <Loader2
              size={36}
              className="mx-auto animate-spin"
              style={{ color: "var(--brand-start)" }}
            />
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Processing your file...
            </p>
            {/* Progress shimmer */}
            <div className="mx-auto h-2 w-48 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
              <div
                className="h-full rounded-full animate-shimmer"
                style={{
                  background: "linear-gradient(90deg, var(--brand-start), var(--brand-end), var(--brand-start))",
                  backgroundSize: "200% 100%",
                  width: "100%"
                }}
              />
            </div>
          </>
        ) : (
          <>
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "rgba(99,102,241,0.08)" }}
            >
              <Upload size={24} style={{ color: "var(--brand-start)" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Drag & drop your file here
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                or click to browse — CSV, XLS, XLSX (max 10MB)
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-1">
              {["CSV", "XLS", "XLSX"].map((ext) => (
                <span key={ext} className="badge badge-brand">
                  <FileSpreadsheet size={12} />
                  .{ext}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
