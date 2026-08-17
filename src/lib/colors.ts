export const PERSON_COLORS = [
  "#4ECDC4",
  "#FF6B6B",
  "#45B7D1",
  "#FFEAA7",
  "#DDA0DD",
  "#96CEB4",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
  "#F0A500",
] as const;

const COLOR_BY_NAME: Record<string, string> = {
  Alice: "#4ECDC4",
  Bob: "#FF6B6B",
  Con: "#45B7D1",
  Dana: "#FFEAA7",
  Alex: "#DDA0DD",
};

export function nameColor(name: string, allNames: string[] = []): string {
  if (COLOR_BY_NAME[name]) return COLOR_BY_NAME[name];
  const idx = Math.max(0, allNames.indexOf(name));
  return PERSON_COLORS[idx % PERSON_COLORS.length];
}
