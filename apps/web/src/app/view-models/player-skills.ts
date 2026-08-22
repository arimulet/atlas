export const PLAYER_SKILL_DEFINITIONS = [
  { key: "stamina", shortLabel: "STA", trainingPriority: 1 },
  { key: "pace", shortLabel: "PAC", trainingPriority: 8 },
  { key: "technique", shortLabel: "TEC", trainingPriority: 5 },
  { key: "passing", shortLabel: "PAS", trainingPriority: 4 },
  { key: "keeper", shortLabel: "GK", trainingPriority: 2 },
  { key: "defender", shortLabel: "DEF", trainingPriority: 6 },
  { key: "playmaker", shortLabel: "PM", trainingPriority: 3 },
  { key: "striker", shortLabel: "SCO", trainingPriority: 7 }
] as const;

export type PlayerSkillKey = (typeof PLAYER_SKILL_DEFINITIONS)[number]["key"];
