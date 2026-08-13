"use client";

import { useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import CountUp from "react-countup";
import { AreaChart, BarChart3, PieChart as PieChartIcon, Sparkles, TrendingUp, TrendingDown, Target } from "lucide-react/dist/cjs/lucide-react.js";
import { init, getInstanceByDom, EChartsOption } from "echarts";
import type { EChartsType } from "echarts";

export type RichDashboardProps = {
  title: string;
  subtitle: string;
  metrics: Array<{ label: string; value: number; trend?: number; tone?: "brand" | "emerald" | "amber" | "rose" }>;
  series: Array<{ name: string; type: "line" | "bar"; data: number[] }>;
  categories: string[];
  segments: Array<{ name: string; value: number }>;
};

function toneClasses(tone?: RichDashboardProps["metrics"][number]["tone"]) {
  switch (tone) {
    case "emerald": return "from-emerald-500/20 to-emerald-500/5 text-emerald-700 dark:text-emerald-200";
    case "amber": return "from-amber-500/20 to-amber-500/5 text-amber-700 dark:text-amber-200";
    case "rose": return "from-rose-500/20 to-rose-500/5 text-rose-700 dark:text-rose-200";
    default: return "from-brand-500/20 to-cyan-500/5 text-brand-700 dark:text-brand-200";
  }
}

export function RichDashboard({ title, subtitle, metrics, series, categories, segments }: RichDashboardProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const pieRef = useRef<HTMLDivElement | null>(null);
  const chartInstance = useRef<EChartsType | null>(null);
  const pieInstance = useRef<EChartsType | null>(null);

  const lineOption = useMemo<EChartsOption>(() => ({
    tooltip: { trigger: "axis" },
    legend: { data: series.map((s) => s.name) },
    grid: { left: "8%", right: "4%", top: "12%", bottom: "12%" },
    xAxis: { type: "category", data: categories, axisLine: { show: false }, axisTick: { show: false } },
    yAxis: { type: "value", axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: "rgba(148,163,184,0.2)" } } },
    series: series.map((item) => ({
      name: item.name,
      type: item.type,
      smooth: true,
      lineStyle: { width: 3 },
      areaStyle: item.type === "line" ? { opacity: 0.2 } : undefined,
      data: item.data
    }))
  }), [categories, series]);

  const pieOption = useMemo<EChartsOption>(() => ({
    tooltip: { trigger: "item" },
    legend: { top: "bottom" },
    series: [{
      name: "Share",
      type: "pie",
      radius: [40, 90],
      data: segments.map((segment) => ({ name: segment.name, value: segment.value })),
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.2)" } }
    }]
  }), [segments]);

  useEffect(() => {
    const dom = chartRef.current;
    if (!dom) return;

    if (!chartInstance.current) {
      try {
        chartInstance.current = getInstanceByDom(dom) || init(dom, undefined, { renderer: "canvas" });
      } catch (e) {
        // ignore init errors for now
      }
    }
    const chart = chartInstance.current;
    if (!chart) return;

    try {
      chart.clear();
      chart.setOption(lineOption);
      // ensure proper sizing after render
      setTimeout(() => chart.resize(), 50);
    } catch (e) {
      // swallow errors
    }

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      try {
        chart.dispose();
      } catch {}
      chartInstance.current = null;
    };
  }, [lineOption]);

  useEffect(() => {
    const dom = pieRef.current;
    if (!dom) return;

    if (!pieInstance.current) {
      try {
        pieInstance.current = getInstanceByDom(dom) || init(dom, undefined, { renderer: "canvas" });
      } catch (e) {}
    }
    const chart = pieInstance.current;
    if (!chart) return;

    try {
      chart.clear();
      chart.setOption(pieOption);
      setTimeout(() => chart.resize(), 50);
    } catch (e) {}

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      try {
        chart.dispose();
      } catch {}
      pieInstance.current = null;
    };
  }, [pieOption]);

  return (
    <section className="space-y-6 rounded-[2rem] border border-white/30 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:bg-slate-900/70">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-600">Executive dashboard</p>
          <h3 className="text-xl font-black text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 text-sm font-semibold text-brand-700 dark:text-brand-200">
          <Sparkles size={14} /> AI-driven visual intelligence
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * index }}
            className={`rounded-[1.25rem] border border-white/50 bg-gradient-to-br ${toneClasses(metric.tone)} p-4 shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold opacity-80">{metric.label}</p>
              {metric.trend && metric.trend >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </div>
            <div className="mt-4 text-3xl font-black">
              <CountUp end={metric.value} duration={1.2} decimals={metric.value % 1 === 0 ? 0 : 2} />
            </div>
            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.25em] opacity-70">
              {metric.trend !== undefined ? `${metric.trend > 0 ? "+" : ""}${metric.trend}% vs prior` : "Live metric"}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[1.5rem] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
            <AreaChart size={16} /> Multi-series performance
          </div>
          <div ref={chartRef} className="h-[320px] w-full" />
        </div>
        <div className="rounded-[1.5rem] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
            <PieChartIcon size={16} /> Segment mix
          </div>
          <div ref={pieRef} className="h-[320px] w-full" />
        </div>
      </div>
    </section>
  );
}
