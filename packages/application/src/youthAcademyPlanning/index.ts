import {
  MongoClubRepository,
  MongoJuniorRepository,
  MongoSnapshotRepository
} from "@atlas/database";
import type { PersistedSnapshot } from "@atlas/database";
import type {
  RealYouthAcademyPlayerPlan,
  RealYouthAcademyPlanning,
  YouthAcademyCategory,
  YouthAcademyEvidence,
  YouthAcademyObservedPlayer,
  YouthAcademySignal,
  YouthAcademyWarning
} from "./types.js";
import { ClubId, buildClubOperatingSettings } from "@atlas/application";

const clubRepository = new MongoClubRepository();
const juniorRepository = new MongoJuniorRepository();
const snapshotRepository = new MongoSnapshotRepository();

export const getRealYouthAcademyPlanning = async (
  clubId: ClubId
): Promise<RealYouthAcademyPlanning> => {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  const settings = buildClubOperatingSettings(club);
  const academyInvestment = settings.effective.preferences["academy.investment"] ?? "balanced";

  const snapshots = await snapshotRepository.listByClub(clubId);
  const snapshotsWithJuniors = snapshots.filter((snapshot) => snapshot.juniors.length > 0);
  const latest = snapshotsWithJuniors.at(-1) ?? null;

  if (!latest) {
    return buildEmptyPlanning(clubId, academyInvestment);
  }

  const currentJuniors = await juniorRepository.listByClub(club.clubId);
  const initialWeeksByJuniorId = new Map(
    currentJuniors.map((junior) => [junior.juniorId, junior.initialWeeks])
  );
  const latestCompletedTrainingSkillChanges =
    calculateLatestCompletedYouthSkillChanges(snapshotsWithJuniors);
  const warnings: YouthAcademyWarning[] = [];
  const observedPlayers: YouthAcademyObservedPlayer[] = latest.juniors.map((p) => {
    return {
      id: p.id,
      playerId: p.playerId,
      name: p.name,
      age: p.age,
      initialWeeksRemaining: initialWeeksByJuniorId.get(p.playerId) ?? null,
      weeksRemaining: p.weeksRemaining,
      skill: p.skill,
      skillChange: latestCompletedTrainingSkillChanges.get(p.playerId) ?? null,
      status: p.status
    };
  });

  const playerPlans = observedPlayers.map((player) => classifyYouthPlayer(player));

  const categoryCounts: Record<YouthAcademyCategory, number> = {
    standout_prospect: 0,
    ready_for_promotion: 0,
    follow_up: 0,
    stagnation_risk: 0,
    insufficient_data: 0
  };

  for (const plan of playerPlans) {
    categoryCounts[plan.category]++;
  }

  if (snapshotsWithJuniors.length < 2) {
    warnings.push({
      code: "insufficient_youth_snapshots",
      message:
        "Hay pocos snapshots de cantera; las proyecciones de promocion dependen de los datos observados actuales.",
      evidence: [
        { kind: "observed", label: "Snapshots de cantera", value: snapshotsWithJuniors.length }
      ]
    });
  }

  return {
    clubId,
    snapshotId: latest.id,
    snapshotDate: latest.snapshotDate.toISOString().slice(0, 10),
    observed: {
      players: observedPlayers,
      coverage: {
        totalYouthCount: observedPlayers.length,
        youthsWithWeeksRemaining: observedPlayers.filter((p) => p.weeksRemaining !== null).length,
        youthsWithSkill: observedPlayers.length
      },
      source: "snapshot.juniors"
    },
    manual: {
      academyInvestment
    },
    derived: {
      categoryCounts,
      players: playerPlans
    },
    warnings
  };
};

function buildEmptyPlanning(clubId: ClubId, academyInvestment: string): RealYouthAcademyPlanning {
  return {
    clubId,
    snapshotId: null,
    snapshotDate: null,
    observed: {
      players: [],
      coverage: {
        totalYouthCount: 0,
        youthsWithWeeksRemaining: 0,
        youthsWithSkill: 0
      },
      source: "snapshot.juniors"
    },
    manual: {
      academyInvestment
    },
    derived: {
      categoryCounts: {
        standout_prospect: 0,
        ready_for_promotion: 0,
        follow_up: 0,
        stagnation_risk: 0,
        insufficient_data: 0
      },
      players: []
    },
    warnings: [
      {
        code: "no_youth_snapshots",
        message:
          "Sin snapshots de cantera importados para este club; importa un snapshot de escuela juvenil para analizar prospectos.",
        evidence: [{ kind: "observed", label: "Snapshots de cantera", value: 0 }]
      }
    ]
  };
}

function classifyYouthPlayer(player: YouthAcademyObservedPlayer): RealYouthAcademyPlayerPlan {
  const signals: YouthAcademySignal[] = [];
  const warnings: YouthAcademyWarning[] = [];
  const evidence: YouthAcademyEvidence[] = [
    { kind: "observed", label: "Nombre", value: player.name },
    { kind: "observed", label: "Edad", value: player.age }
  ];

  if (player.weeksRemaining !== null) {
    evidence.push({ kind: "observed", label: "Semanas restantes", value: player.weeksRemaining });
  }

  const weeksInAcademy =
    player.initialWeeksRemaining !== null && player.weeksRemaining !== null
      ? player.initialWeeksRemaining - player.weeksRemaining + 1
      : null;

  if (weeksInAcademy !== null) {
    evidence.push({ kind: "derived", label: "Semanas en academia", value: weeksInAcademy });
  }

  if (player.skill !== null) {
    evidence.push({ kind: "observed", label: "Skill", value: player.skill });
  }

  const projectedPromotionAge =
    player.weeksRemaining !== null ? player.age + Math.floor(player.weeksRemaining / 16) : null;

  if (projectedPromotionAge !== null) {
    evidence.push({
      kind: "derived",
      label: "Edad proyectada de ascenso",
      value: projectedPromotionAge
    });
  }

  let category: YouthAcademyCategory = "follow_up";
  let severity: RealYouthAcademyPlayerPlan["severity"] = "info";
  let confidence: RealYouthAcademyPlayerPlan["confidence"] = "medium";
  let rationale = "Juvenil en formacion habitual dentro de la escuela juvenil.";

  const isReady =
    player.status === "ready_for_promotion" ||
    (player.weeksRemaining !== null && player.weeksRemaining <= 0);

  const isHigh = isHighLevel(player.skill);

  if (isReady) {
    category = "ready_for_promotion";
    severity = "info";
    confidence = player.weeksRemaining !== null ? "high" : "medium";
    rationale =
      "El juvenil ha completado su ciclo de formacion y esta listo para ser promovido al plantel principal.";
    signals.push({
      code: "youth_ready_for_promotion",
      severity: "info",
      confidence,
      message: "Listo para promocion al primer equipo.",
      evidence
    });
  } else if (
    isHigh &&
    (player.age <= 17 || (player.weeksRemaining !== null && player.weeksRemaining <= 4))
  ) {
    category = "standout_prospect";
    severity = "low";
    confidence = player.weeksRemaining !== null ? "high" : "medium";
    rationale = "Prospecto destacado con skill elevado y proyeccion favorable de ascenso.";
    signals.push({
      code: "standout_youth_prospect",
      severity: "low",
      confidence,
      message: "Prospecto destacado con alto talento estimado.",
      evidence
    });
  } else if (weeksInAcademy !== null && weeksInAcademy >= 16 && !isHigh) {
    category = "stagnation_risk";
    severity = "medium";
    confidence = "medium";
    rationale = "Juvenil con permanencia prolongada en academia y skill no alto.";
    signals.push({
      code: "youth_stagnation_risk",
      severity,
      confidence,
      message: "Riesgo de estancamiento por permanencia prolongada sin nivel alto.",
      evidence
    });
  } else if (player.weeksRemaining === null || player.skill === null) {
    if (player.weeksRemaining === null) {
      warnings.push({
        code: "missing_weeks_remaining",
        message: "Falta semanas restantes; no se puede proyectar la fecha exacta de promocion.",
        evidence
      });
    }
    if (player.skill === null) {
      warnings.push({
        code: "missing_skill",
        message: "Falta skill; la confianza en la evaluacion de talento es menor.",
        evidence
      });
    }
  }

  return {
    id: player.id,
    playerId: player.playerId,
    name: player.name,
    age: player.age,
    initialWeeksRemaining: player.initialWeeksRemaining,
    weeksRemaining: player.weeksRemaining,
    weeksInAcademy,
    projectedPromotionAge,
    skill: player.skill,
    skillChange: player.skillChange,
    status: player.status,
    category,
    severity,
    confidence,
    rationale,
    signals,
    warnings
  };
}

function isHighLevel(skill: number | null): boolean {
  return skill !== null && skill >= 8;
}

export function calculateLatestCompletedYouthSkillChanges(
  snapshots: readonly PersistedSnapshot[]
): Map<number, number> {
  const currentGameWeek = snapshots.at(-1)?.gameWeek ?? null;

  if (currentGameWeek === null) {
    return new Map();
  }

  const latestSnapshotByCompletedGameWeek = new Map<number, PersistedSnapshot>();

  for (const snapshot of snapshots) {
    if (snapshot.gameWeek !== null && snapshot.gameWeek !== currentGameWeek) {
      latestSnapshotByCompletedGameWeek.set(snapshot.gameWeek, snapshot);
    }
  }

  const completedTrainingSnapshots = [...latestSnapshotByCompletedGameWeek.values()];
  const latestCompletedTraining = completedTrainingSnapshots.at(-1) ?? null;
  const previousCompletedTraining = completedTrainingSnapshots.at(-2) ?? null;

  if (!latestCompletedTraining || !previousCompletedTraining) {
    return new Map();
  }

  const previousSkillByJuniorId = new Map(
    previousCompletedTraining.juniors.map((junior) => [junior.playerId, junior.skill] as const)
  );

  return new Map(
    latestCompletedTraining.juniors.flatMap((junior) => {
      const previousSkill = previousSkillByJuniorId.get(junior.playerId);

      if (junior.skill === null || previousSkill === null || previousSkill === undefined) {
        return [];
      }

      return [[junior.playerId, junior.skill - previousSkill] as const];
    })
  );
}
export * from "./types.js";
