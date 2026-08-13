"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type Props = {
  data: { month: string; revenue: number }[];
};

export function TrendChart({ data }: Props) {
  if (!data?.length) {
    return <p className="text-sm text-slate-500">No trend data available.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="revenue" stroke="#0891b2" strokeWidth={2.5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
