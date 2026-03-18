"use client";

interface ImpliedMultiplesProps {
  multiples: { label: string; value: string | number }[];
}

export function ImpliedMultiples({ multiples }: ImpliedMultiplesProps) {
  if (multiples.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {multiples.map((item, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2 rounded-full border border-[var(--iris-border)] px-4 py-2 transition-colors hover:border-[var(--iris-data)]/30"
          style={{
            background:
              "linear-gradient(135deg, rgba(14,16,23,0.8) 0%, rgba(14,16,23,0.5) 100%)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span className="text-xs text-[var(--iris-text-muted)]">
            {item.label}
          </span>
          <span className="font-mono text-sm font-semibold text-[var(--iris-data)]">
            {typeof item.value === "number"
              ? item.value.toFixed(1) + "x"
              : item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
