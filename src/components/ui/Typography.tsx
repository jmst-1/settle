export function Amt({
  value,
  color,
  size = 14,
}: {
  value: number;
  color?: string;
  size?: number;
}) {
  const str = Number(value).toFixed(2);
  const [int, dec] = str.split(".");
  return (
    <span
      className="font-mono font-bold tracking-tight"
      style={{ color: color || "#F0EDE8", fontSize: size }}
    >
      {int}
      <span style={{ opacity: 0.45, fontSize: size * 0.82 }}>.{dec}</span>
    </span>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-muted">
      {children}
    </div>
  );
}

export function Perf() {
  return <div className="perf" />;
}

export function SectionHeader({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-gradient-to-b from-card to-transparent px-5 pb-4 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          {onBack && (
            <button
              onClick={onBack}
              className="mb-2.5 p-0 text-[13px] font-semibold text-dim"
            >
              ← Back
            </button>
          )}
          <h1 className="m-0 text-2xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && (
            <div className="mt-1 font-mono text-xs text-muted">{subtitle}</div>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}
