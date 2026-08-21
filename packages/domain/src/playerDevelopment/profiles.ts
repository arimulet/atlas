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
      { skill: "keeper", priority: "primary", defaultTargetLevel: 12 },
      { skill: "pace", priority: "secondary", defaultTargetLevel: 9 },
      { skill: "passing", priority: "supporting", defaultTargetLevel: 8 }
    ]
  },
  defender: {
    id: "defender",
    relevantSkills: [
      { skill: "defender", priority: "primary", defaultTargetLevel: 12 },
      { skill: "pace", priority: "primary", defaultTargetLevel: 10 },
      { skill: "technique", priority: "secondary", defaultTargetLevel: 9 },
      { skill: "playmaker", priority: "supporting", defaultTargetLevel: 7 }
    ]
  },
  wing_defender: {
    id: "wing_defender",
    relevantSkills: [
      { skill: "pace", priority: "primary", defaultTargetLevel: 12 },
      { skill: "defender", priority: "primary", defaultTargetLevel: 10 },
      { skill: "technique", priority: "secondary", defaultTargetLevel: 10 },
      { skill: "passing", priority: "supporting", defaultTargetLevel: 8 }
    ]
  },
  midfielder: {
    id: "midfielder",
    relevantSkills: [
      { skill: "playmaker", priority: "primary", defaultTargetLevel: 12 },
      { skill: "passing", priority: "primary", defaultTargetLevel: 11 },
      { skill: "technique", priority: "secondary", defaultTargetLevel: 10 },
      { skill: "pace", priority: "supporting", defaultTargetLevel: 9 }
    ]
  },
  winger: {
    id: "winger",
    relevantSkills: [
      { skill: "pace", priority: "primary", defaultTargetLevel: 12 },
      { skill: "technique", priority: "primary", defaultTargetLevel: 11 },
      { skill: "passing", priority: "secondary", defaultTargetLevel: 10 },
      { skill: "playmaker", priority: "supporting", defaultTargetLevel: 9 }
    ]
  },
  forward: {
    id: "forward",
    relevantSkills: [
      { skill: "striker", priority: "primary", defaultTargetLevel: 13 },
      { skill: "pace", priority: "primary", defaultTargetLevel: 12 },
      { skill: "technique", priority: "secondary", defaultTargetLevel: 10 },
      { skill: "passing", priority: "supporting", defaultTargetLevel: 7 }
    ]
  }
};

export const DEVELOPMENT_PROFILE_ORDER: readonly DevelopmentProfile[] = [
  "goalkeeper",
  "defender",
  "wing_defender",
  "midfielder",
  "winger",
  "forward"
];

export const DEVELOPMENT_PROFILE_SIGNATURE_SKILLS: Readonly<
  Record<DevelopmentProfile, DevelopmentSkill>
> = {
  goalkeeper: "keeper",
  defender: "defender",
  wing_defender: "pace",
  midfielder: "playmaker",
  winger: "technique",
  forward: "striker"
};

export const DEVELOPMENT_PROFILE_SIGNATURE_BONUSES: Readonly<Record<DevelopmentProfile, number>> = {
  goalkeeper: 2.5,
  defender: 1.5,
  wing_defender: 1,
  midfielder: 1.5,
  winger: 1,
  forward: 2.5
};
