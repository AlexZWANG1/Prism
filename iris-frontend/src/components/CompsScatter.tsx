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
      className="border border-[var(--iris-border)] px-2 py-1 rounded-[2px]"
      style={{ background: "rgba(14,16,23,0.95)" }}
    >
      <p
        className={`font-['JetBrains_Mono',monospace] text-[12px] font-semibold ${
          point.isTarget
            ? "text-[var(--iris-accent)]"
            : "text-[#2DD4BF]"
        }`}
      >
        {point.ticker}
        {point.isTarget && (
          <span className="ml-1 text-[10px] font-normal text-[var(--iris-text-muted)]">
            (target)
          </span>
        )}
      </p>
      <div className="flex gap-3 text-[10px] text-[var(--iris-text-secondary)]">
        <span>
          x: <span className="font-['JetBrains_Mono',monospace]">{point.x.toFixed(1)}</span>
        </span>
        <span>
          y: <span className="font-['JetBrains_Mono',monospace]">{point.y.toFixed(1)}%</span>
        </span>
      </div>
    </div>
  );
}

export function CompsScatter({ data, xLabel, yLabel }: CompsScatterProps) {
  if (data.length === 0) return null;

  return (
    <div className="border border-[var(--iris-border)] rounded-[3px] overflow-hidden">
      <div className="border-b border-[var(--iris-border)] bg-[var(--iris-surface)] px-2 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--iris-text-muted)]">
          Valuation Scatter
        </span>
      </div>
      <div className="p-1">
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 8, right: 12, bottom: 30, left: 20 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--iris-border)"
              opacity={0.3}
            />
            <XAxis
              type="number"
              dataKey="x"
              tick={{ fill: "#525264", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
              stroke="var(--iris-border)"
              tickLine={{ stroke: "var(--iris-border)" }}
            >
              <Label
                value={xLabel}
                position="bottom"
                offset={10}
                style={{
                  fill: "#8B8B9E",
                  fontSize: 10,
                  fontWeight: 500,
                }}
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="y"
              tick={{ fill: "#525264", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
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
                  fontSize: 10,
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
                  r={entry.isTarget ? 7 : 4}
                  stroke={entry.isTarget ? "#C9A84C" : "transparent"}
                  strokeWidth={entry.isTarget ? 2 : 0}
                  opacity={entry.isTarget ? 1 : 0.75}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
