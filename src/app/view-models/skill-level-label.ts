const SKILL_LEVEL_LABELS_ES: Readonly<Record<number, string>> = {
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

export const SKILL_LEVEL_LABELS_EN: Readonly<Record<number, string>> = {
  0: "tragic",
  1: "hopeless",
  2: "unsatisfactory",
  3: "poor",
  4: "weak",
  5: "average",
  6: "adequate",
  7: "good",
  8: "solid",
  9: "very good",
  10: "excellent",
  11: "formidable",
  12: "outstanding",
  13: "incredible",
  14: "brilliant",
  15: "magical",
  16: "unearthly",
  17: "divine",
  18: "superdivine"
};

export function skillLevelLabel(level: number | null, lang: "es" | "en" = "es"): string | null {
  if (level === null) return null;
  const labels = lang === "en" ? SKILL_LEVEL_LABELS_EN : SKILL_LEVEL_LABELS_ES;
  return labels[level] ?? null;
}

export function skillLevelLabelEn(level: number | null): string | null {
  return skillLevelLabel(level, "en");
}

export function formatSokkerSkill(level: number | null | undefined, lang: "en" | "es" = "en"): string {
  if (level === null || level === undefined) return "—";
  const label = lang === "en" ? skillLevelLabelEn(level) : skillLevelLabel(level);
  return label ? `${label} [${level}]` : `[${level}]`;
}
