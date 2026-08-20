import type {
  SquadAssessment,
  SquadPlayerContext,
  SquadRole,
  SquadRoleAssignment
} from "@atlas/domain";

export type { SquadAssessment, SquadPlayerContext, SquadRole, SquadRoleAssignment };

export interface SquadAssessmentData extends SquadAssessment {
  manualAssignments: SquadRoleAssignment[];
}
