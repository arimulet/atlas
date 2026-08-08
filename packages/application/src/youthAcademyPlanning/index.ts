import { MongoClubRepository, MongoYouthSnapshotRepository } from "@atlas/database";
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
const youthSnapshotRepository = new MongoYouthSnapshotRepository();

export const getRealYouthAcademyPlanning = async (
  clubId: ClubId
): Promise<RealYouthAcademyPlanning> => {
  const club = await clubRepository.findById(clubId.toString());

  if (!club) {
    throw new Error(`Club not found: ${clubId}`);
  }

  const settings = buildClubOperatingSettings(club);
  const academyInvestment = settings.effective.preferences["academy.investment"] ?? "balanced";

  const snapshots = await youthSnapshotRepository.listByClub(clubId);
  const latest = snapshots.at(-1) ?? null;

  if (!latest) {
    return buildEmptyPlanning(clubId, academyInvestment);
  }

  const warnings: YouthAcademyWarning[] = [];
  const observedPlayers: YouthAcademyObservedPlayer[] = latest.players.map((p) => ({
    id: p.id,
    externalId: p.externalId,
    name: p.name,
    age: p.age,
    weeksInAcademy: p.weeksInAcademy,
    weeksRemaining: p.weeksRemaining,
    estimatedLevel: p.estimatedLevel,
    status: p.status
  }));

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

  if (snapshots.length < 2) {
    warnings.push({
      code: "insufficient_youth_snapshots",
      message:
        "Hay pocos snapshots de cantera; las proyecciones de promocion dependen de los datos observados actuales.",
      evidence: [{ kind: "observed", label: "Snapshots de cantera", value: snapshots.length }]
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
        youthsWithEstimatedLevel: observedPlayers.filter((p) => p.estimatedLevel !== null).length
      },
      weeklyInvestment: latest.weeklyInvestment
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

function buildEmptyPlanning(
  clubId: ClubId,
  academyInvestment: string
): RealYouthAcademyPlanning {
  return {
    clubId,
    snapshotId: null,
    snapshotDate: null,
    observed: {
      players: [],
      coverage: {
        totalYouthCount: 0,
        youthsWithWeeksRemaining: 0,
        youthsWithEstimatedLevel: 0
      },
      weeklyInvestment: null
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

  if (player.weeksInAcademy !== null) {
    evidence.push({ kind: "observed", label: "Semanas en escuela", value: player.weeksInAcademy });
  }

  if (player.weeksRemaining !== null) {
    evidence.push({ kind: "observed", label: "Semanas restantes", value: player.weeksRemaining });
  }

  if (player.estimatedLevel) {
    evidence.push({ kind: "observed", label: "Nivel estimado", value: player.estimatedLevel });
  }

  const projectedPromotionAge =
    player.weeksRemaining !== null
      ? player.age + Math.floor(player.weeksRemaining / 16)
      : null;

  if (projectedPromotionAge !== null) {
    evidence.push({ kind: "derived", label: "Edad proyectada de ascenso", value: projectedPromotionAge });
  }

  let category: YouthAcademyCategory = "follow_up";
  let severity: RealYouthAcademyPlayerPlan["severity"] = "info";
  let confidence: RealYouthAcademyPlayerPlan["confidence"] = "medium";
  let rationale = "Juvenil en formacion habitual dentro de la escuela juvenil.";

  const isReady =
    player.status === "ready_for_promotion" ||
    (player.weeksRemaining !== null && player.weeksRemaining <= 0);

  const isHigh = isHighLevel(player.estimatedLevel);

  if (isReady) {
    category = "ready_for_promotion";
    severity = "info";
    confidence = player.weeksRemaining !== null ? "high" : "medium";
    rationale = "El juvenil ha completado su ciclo de formacion y esta listo para ser promovido al plantel principal.";
    signals.push({
      code: "youth_ready_for_promotion",
      severity: "info",
      confidence,
      message: "Listo para promocion al primer equipo.",
      evidence
    });
  } else if (isHigh && (player.age <= 17 || (player.weeksRemaining !== null && player.weeksRemaining <= 4))) {
    category = "standout_prospect";
    severity = "low";
    confidence = player.weeksRemaining !== null ? "high" : "medium";
    rationale = "Prospecto destacado con nivel estimado elevado y proyeccion favorable de ascenso.";
    signals.push({
      code: "standout_youth_prospect",
      severity: "low",
      confidence,
      message: "Prospecto destacado con alto talento estimado.",
      evidence
    });
  } else if (player.weeksInAcademy !== null && player.weeksInAcademy >= 16 && !isHigh) {
    category = "stagnation_risk";
    severity = "medium";
    confidence = "medium";
    rationale = "El juvenil acumula 16 o mas semanas en la escuela con nivel estimado modesto o estancado.";
    signals.push({
      code: "youth_stagnation_risk",
      severity: "medium",
      confidence: "medium",
      message: "Riesgo de estancamiento en la escuela juvenil.",
      evidence
    });
  } else if (player.weeksRemaining === null || !player.estimatedLevel) {
    if (player.weeksRemaining === null) {
      warnings.push({
        code: "missing_weeks_remaining",
        message: "Falta semanas restantes; no se puede proyectar la fecha exacta de promocion.",
        evidence
      });
    }
    if (!player.estimatedLevel) {
      warnings.push({
        code: "missing_estimated_level",
        message: "Falta nivel estimado; la confianza en la evaluacion de talento es menor.",
        evidence
      });
    }
  }

  return {
    id: player.id,
    externalId: player.externalId,
    name: player.name,
    age: player.age,
    weeksInAcademy: player.weeksInAcademy,
    weeksRemaining: player.weeksRemaining,
    projectedPromotionAge,
    estimatedLevel: player.estimatedLevel,
    status: player.status,
    category,
    severity,
    confidence,
    rationale,
    signals,
    warnings
  };
}

function isHighLevel(estimatedLevel?: string | null): boolean {
  if (!estimatedLevel) return false;
  const normalized = estimatedLevel.trim().toLowerCase();
  const highKeywords = [
    "good",
    "great",
    "solid",
    "formidable",
    "outstanding",
    "brilliant",
    "magnificent",
    "master",
    "superb",
    "godlike",
    "bueno",
    "excelente",
    "formidable",
    "destacado"
  ];

  if (highKeywords.includes(normalized)) {
    return true;
  }

  const num = Number.parseFloat(normalized);
  return !Number.isNaN(num) && num >= 8;
}

export * from "./types.js";
