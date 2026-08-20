import type {
  SquadDepthAnalysis,
  SquadDepthPlayer,
  SquadAssessment,
  SquadPlayerContext,
  SquadRole,
  SquadRoleAssignment
} from "@atlas/domain";

export type { SquadAssessment, SquadPlayerContext, SquadRole, SquadRoleAssignment };
export type { SquadDepthAnalysis };
export type { SquadDepthPlayer };

export interface SquadAssessmentData extends SquadAssessment {
  manualAssignments: SquadRoleAssignment[];
  currentGameWeek: number | null;
  depthPlayers: SquadDepthPlayer[];
}
