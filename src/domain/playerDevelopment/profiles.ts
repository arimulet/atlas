import type {
  DevelopmentPriority,
  DevelopmentProfile,
  DevelopmentProfileDefinition
} from "./types.js";

import type { DevelopmentSkill } from "./types.js";

export const DEVELOPMENT_PRIORITY_WEIGHTS: Readonly<Record<DevelopmentPriority, number>> = {
  primary: 3,
  secondary: 2,
  supporting: 1
};

export const DEVELOPMENT_PROFILES: Readonly<
  Record<DevelopmentProfile, DevelopmentProfileDefinition>
> = {
  goalkeeper: {
    id: "goalkeeper",
    relevantSkills: [
      { skill: "keeper", priority: "primary", defaultTargetLevel: 17 },
      { skill: "pace", priority: "primary", defaultTargetLevel: 16 },
      { skill: "passing", priority: "supporting", defaultTargetLevel: 13 }
    ]
  },
  defender: {
    id: "defender",
    relevantSkills: [
      { skill: "defender", priority: "primary", defaultTargetLevel: 17 },
      { skill: "pace", priority: "primary", defaultTargetLevel: 17 },
      { skill: "technique", priority: "secondary", defaultTargetLevel: 14 },
      { skill: "passing", priority: "supporting", defaultTargetLevel: 13 }
    ]
  },
  midfielder: {
    id: "midfielder",
    relevantSkills: [
      { skill: "playmaker", priority: "primary", defaultTargetLevel: 17 },
      { skill: "passing", priority: "primary", defaultTargetLevel: 17 },
      { skill: "pace", priority: "primary", defaultTargetLevel: 17 },
      { skill: "technique", priority: "secondary", defaultTargetLevel: 16 }
    ]
  },
  forward: {
    id: "forward",
    relevantSkills: [
      { skill: "striker", priority: "primary", defaultTargetLevel: 17 },
      { skill: "pace", priority: "primary", defaultTargetLevel: 17 },
      { skill: "technique", priority: "primary", defaultTargetLevel: 17 },
      { skill: "passing", priority: "supporting", defaultTargetLevel: 13 }
    ]
  }
};

export const DEVELOPMENT_PROFILE_ORDER: readonly DevelopmentProfile[] = [
  "goalkeeper",
  "defender",
  "midfielder",
  "forward"
];

export const DEVELOPMENT_PROFILE_SIGNATURE_SKILLS: Readonly<
  Record<DevelopmentProfile, DevelopmentSkill>
> = {
  goalkeeper: "keeper",
  defender: "defender",
  midfielder: "playmaker",
  forward: "striker"
};

export const DEVELOPMENT_PROFILE_SIGNATURE_BONUSES: Readonly<Record<DevelopmentProfile, number>> = {
  goalkeeper: 2.5,
  defender: 1.5,
  midfielder: 1.5,
  forward: 2.5
};
