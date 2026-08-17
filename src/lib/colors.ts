export const PERSON_COLORS = [
  "#2A9D8F",
  "#E24B4B",
  "#2E8BB8",
  "#C9A227",
  "#B07CB0",
  "#3D9A7A",
  "#C9A227",
  "#9B7BB8",
  "#5BA4C9",
  "#D4920B",
] as const;

const COLOR_BY_NAME: Record<string, string> = {
  Alice: "#2A9D8F",
  Bob: "#E24B4B",
  Con: "#2E8BB8",
  Dana: "#C9A227",
  Alex: "#B07CB0",
};

export function nameColor(name: string, allNames: string[] = []): string {
  if (COLOR_BY_NAME[name]) return COLOR_BY_NAME[name];
  const idx = Math.max(0, allNames.indexOf(name));
  return PERSON_COLORS[idx % PERSON_COLORS.length];
}
