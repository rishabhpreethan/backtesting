"use client";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { EquityPoint } from "@/lib/types";

export default function EquityCurve({ data }: { data: EquityPoint[] }) {
  const rows = data.map((p) => ({
    time: p.time,
    label: new Date(p.time).toLocaleString(),
    equity: Number(p.equity.toFixed(2)),
    drawdown: Number(p.drawdown.toFixed(2)),
  }));

  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="label" hide tick={false} />
          <YAxis domain={["auto", "auto"]} stroke="#888" />
          <Tooltip formatter={(value) => (typeof value === 'number' ? value.toFixed(2) : value as any)} labelFormatter={(l) => l} />
          <Line type="monotone" dataKey="equity" stroke="#2563eb" dot={false} strokeWidth={2} name="Equity" />
          <Line type="monotone" dataKey="drawdown" stroke="#ef4444" dot={false} strokeWidth={1.5} name="Drawdown" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
