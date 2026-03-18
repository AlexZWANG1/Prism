"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Label,
} from "recharts";
import type { ScatterPoint } from "@/types/analysis";

interface CompsScatterProps {
  data: ScatterPoint[];
  xLabel: string;
  yLabel: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ScatterPoint;
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div
      className="rounded-lg border border-[var(--iris-border)] px-3 py-2 shadow-xl"
      style={{
        background: "rgba(14,16,23,0.95)",
        backdropFilter: "blur(12px)",
      }}
    >
      <p
        className={`mb-1 font-mono text-sm font-semibold ${
          point.isTarget
            ? "text-[var(--iris-accent)]"
            : "text-[var(--iris-data)]"
        }`}
      >
        {point.ticker}
        {point.isTarget && (
          <span className="ml-1 text-[10px] font-normal text-[var(--iris-text-muted)]">
            (target)
          </span>
        )}
      </p>
      <div className="flex gap-3 text-xs text-[var(--iris-text-secondary)]">
        <span>
          x: <span className="font-mono">{point.x.toFixed(1)}</span>
        </span>
        <span>
          y: <span className="font-mono">{point.y.toFixed(1)}%</span>
        </span>
      </div>
    </div>
  );
}

export function CompsScatter({ data, xLabel, yLabel }: CompsScatterProps) {
  if (data.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--iris-border)]">
      <div className="border-b border-[var(--iris-border)] bg-[var(--iris-surface)] px-5 py-3">
        <h3 className="text-sm font-semibold text-[var(--iris-accent)]">
          Valuation Scatter
        </h3>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 35, left: 25 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--iris-border)"
              opacity={0.4}
            />
            <XAxis
              type="number"
              dataKey="x"
              tick={{ fill: "#525264", fontSize: 10, fontFamily: "monospace" }}
              stroke="var(--iris-border)"
              tickLine={{ stroke: "var(--iris-border)" }}
            >
              <Label
                value={xLabel}
                position="bottom"
                offset={12}
                style={{
                  fill: "#8B8B9E",
                  fontSize: 11,
                  fontWeight: 500,
                }}
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="y"
              tick={{ fill: "#525264", fontSize: 10, fontFamily: "monospace" }}
              stroke="var(--iris-border)"
              tickLine={{ stroke: "var(--iris-border)" }}
            >
              <Label
                value={yLabel}
                angle={-90}
                position="insideLeft"
                offset={-8}
                style={{
                  fill: "#8B8B9E",
                  fontSize: 11,
                  fontWeight: 500,
                }}
              />
            </YAxis>
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ strokeDasharray: "3 3", stroke: "var(--iris-border)" }}
            />
            <Scatter data={data}>
              {data.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.isTarget ? "#C9A84C" : "#2DD4BF"}
                  r={entry.isTarget ? 9 : 5}
                  stroke={entry.isTarget ? "#C9A84C" : "transparent"}
                  strokeWidth={entry.isTarget ? 2 : 0}
                  opacity={entry.isTarget ? 1 : 0.8}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
