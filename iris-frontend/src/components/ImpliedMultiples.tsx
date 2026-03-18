"use client";

interface ImpliedMultiplesProps {
  multiples: { label: string; value: string | number }[];
}

export function ImpliedMultiples({ multiples }: ImpliedMultiplesProps) {
  if (multiples.length === 0) return null;

  return (
    <div className="flex items-baseline gap-0 text-[12px]">
      {multiples.map((item, idx) => (
        <span key={idx} className="flex items-baseline">
          {idx > 0 && (
            <span className="mx-2 text-[var(--iris-border)]">|</span>
          )}
          <span className="text-[var(--iris-text-muted)]">
            {item.label}:
          </span>
          <span className="ml-1 font-mono font-semibold text-[var(--iris-data)]">
            {typeof item.value === "number"
              ? item.value.toFixed(1) + "x"
              : item.value}
          </span>
        </span>
      ))}
    </div>
  );
}
