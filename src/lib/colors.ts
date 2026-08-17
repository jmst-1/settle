export const PERSON_COLORS = [
  "#5B4B8A",
  "#C4452D",
  "#2F5D7C",
  "#C4A035",
  "#7A4E6D",
  "#9A7A32",
  "#3F6B5A",
  "#8C4A3A",
  "#4A6B8A",
  "#B56B2A",
] as const;

const COLOR_BY_NAME: Record<string, string> = {
  Alice: "#5B4B8A",
  Bob: "#C4452D",
  Con: "#2F5D7C",
  Dana: "#C4A035",
  Alex: "#7A4E6D",
};

export function nameColor(name: string, allNames: string[] = []): string {
  if (COLOR_BY_NAME[name]) return COLOR_BY_NAME[name];
  const idx = Math.max(0, allNames.indexOf(name));
  return PERSON_COLORS[idx % PERSON_COLORS.length];
}
