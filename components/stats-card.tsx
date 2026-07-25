"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: number;
  icon: LucideIcon;
  suffix?: string;
  prefix?: string;
  color?: "brand" | "cyan" | "amber" | "emerald";
  delay?: number;
};

const COLOR_MAP = {
  brand: {
    bg: "rgba(99,102,241,0.08)",
    icon: "rgba(99,102,241,0.15)",
    text: "var(--brand-start)"
  },
  cyan: {
    bg: "rgba(6,182,212,0.08)",
    icon: "rgba(6,182,212,0.15)",
    text: "#06b6d4"
  },
  amber: {
    bg: "rgba(245,158,11,0.08)",
    icon: "rgba(245,158,11,0.15)",
    text: "#f59e0b"
  },
  emerald: {
    bg: "rgba(16,185,129,0.08)",
    icon: "rgba(16,185,129,0.15)",
    text: "#10b981"
  }
};

export function StatsCard({ label, value, icon: Icon, suffix, prefix, color = "brand", delay = 0 }: Props) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const c = COLOR_MAP[color];

  useEffect(() => {
    const timeout = setTimeout(() => {
      const duration = 800;
      const start = performance.now();
      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        setDisplay(Math.round(eased * value));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return (
    <div
      ref={ref}
      className="card p-5 animate-slide-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            {label}
          </p>
          <p className="text-2xl font-extrabold" style={{ color: c.text }}>
            {prefix}{display.toLocaleString()}{suffix}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: c.icon, color: c.text }}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}
