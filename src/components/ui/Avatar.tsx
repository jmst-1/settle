import { nameColor } from "@/lib/colors";

export function Avatar({
  name,
  names = [],
  size = 28,
}: {
  name?: string | null;
  names?: string[];
  size?: number;
}) {
  if (!name) return null;
  const c = nameColor(name, names);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-extrabold"
      style={{
        width: size,
        height: size,
        background: `${c}28`,
        color: c,
        fontSize: size * 0.38,
        border: `1.5px solid ${c}55`,
      }}
    >
      {name[0]?.toUpperCase()}
    </span>
  );
}

export function AvatarStack({ names, size = 22 }: { names: string[]; size?: number }) {
  return (
    <div className="flex">
      {names.slice(0, 4).map((n, i) => (
        <span key={n} className={i === 0 ? "" : "-ml-1.5"} style={{ zIndex: 10 - i }}>
          <Avatar name={n} names={names} size={size} />
        </span>
      ))}
      {names.length > 4 && (
        <span className="-ml-1.5 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-white/10 bg-card-2 text-[9px] font-bold text-dim">
          +{names.length - 4}
        </span>
      )}
    </div>
  );
}
