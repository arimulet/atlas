const SKILL_LEVEL_LABELS: Readonly<Record<number, string>> = {
  0: "trágico",
  1: "terrible",
  2: "deficiente",
  3: "pobre",
  4: "débil",
  5: "regular",
  6: "aceptable",
  7: "bueno",
  8: "sólido",
  9: "muy bueno",
  10: "excelente",
  11: "formidable",
  12: "destacado",
  13: "increíble",
  14: "brillante",
  15: "mágico",
  16: "sobrenatural",
  17: "divino",
  18: "superdivino"
};

export function skillLevelLabel(level: number | null): string | null {
  return level === null ? null : (SKILL_LEVEL_LABELS[level] ?? null);
}
