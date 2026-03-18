"use client";

interface CalibrationSummaryProps {
  hits: number;
  misses: number;
  recentRecalls: { company: string; date: string; relevance: number }[];
}

export function CalibrationSummary({
  hits,
  misses,
  recentRecalls,
}: CalibrationSummaryProps) {
  const total = hits + misses;
  const accuracy = total > 0 ? (hits / total) * 100 : 0;

  return (
    <div className="space-y-2">
      {/* Inline stats row */}
      <div className="flex items-center gap-3 text-[12px]">
        <span className="text-[11px] text-[var(--iris-text-muted)]">命中</span>
        <span className="font-['JetBrains_Mono',monospace] text-[#22C55E]">{hits}</span>
        <span className="text-[var(--iris-border)]">|</span>
        <span className="text-[11px] text-[var(--iris-text-muted)]">未中</span>
        <span className="font-['JetBrains_Mono',monospace] text-[#EF4444]">{misses}</span>
        <span className="text-[var(--iris-border)]">|</span>
        <span className="text-[11px] text-[var(--iris-text-muted)]">准确率</span>
        <span className="font-['JetBrains_Mono',monospace] text-[#2DD4BF]">{accuracy.toFixed(0)}%</span>
      </div>

      {/* Recent recalls compact list */}
      {recentRecalls.length > 0 && (
        <div className="border-t border-[var(--iris-border)] pt-1">
          {recentRecalls.map((recall, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-0.5 text-[11px]"
            >
              <div className="flex items-center gap-2">
                <span className="font-['JetBrains_Mono',monospace] text-[10px] text-[var(--iris-text-muted)]">
                  {recall.date}
                </span>
                <span className="text-[var(--iris-text)]">
                  {recall.company}
                </span>
              </div>
              <span className="font-['JetBrains_Mono',monospace] text-[#2DD4BF]">
                {(recall.relevance * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
