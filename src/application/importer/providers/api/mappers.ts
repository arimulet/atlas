import { deriveSkillChanges, type StadiumData, type StandLocation, type StandType } from "@atlas/domain";
import { z } from "zod";
import { trainingPlayerSchema } from "./training-schema.js";
import type {
  CurrentClubContextDto,
  HistoricalTrainingSkills,
  JuniorDto,
  PlayerDto,
  PlayerFormation,
  PlayerNameDto,
  PlayerSkillsChangeDto,
  PlayerSkillsDto,
  PlayerTrainingWeekDto,
  TrainerAssignment,
  TrainerDto,
  TrainerSkillDto,
  TrainerSkillsDto,
  TrainingDataDto,
  TrainingSummaryDto,
  TrainingType
} from "../../types.js";
import type {
  SokkerApiCurrentDto,
  SokkerApiFormationDto,
  SokkerJuniorApiDto,
  SokkerApiTeamTrainingDto,
  SokkerApiTrainingFormationsDto,
  SokkerApiTrainingPlayerDto,
  SokkerTrainingPlayerInfoApiDto,
  SokkerPlayerSkillsApiDto,
  SokkerPlayerStatsApiDto,
  SokkerSkillsChangeApiDto,
  SokkerTrainerApiDto,
  SokkerTrainerInfoApiDto,
  SokkerTrainerSkillApiDto,
  SokkerTrainingSummaryApiDto,
  SokkerTrainingSummaryWeekApiDto
} from "./dtos.js";

export function mapCurrentApiToCurrentClubContext(
  source: SokkerApiCurrentDto
): CurrentClubContextDto {
  return {
    userId: source.id,
    userName: source.name,
    team: {
      id: source.team.id,
      name: source.team.name,
      rank: source.team.rank,
      rankPosition: source.team.rankPosition,
      country: {
        code: source.team.country.code,
        name: source.team.country.name
      },
      bankrupt: source.team.bankrupt
    },
    budget: {
      value: source.budget.value,
      currency: source.budget.currency
    },
    training: mapTrainingConfiguration(source.team.training),
    calendar: {
      season: source.today.season,
      gameWeek: source.today.week,
      seasonWeek: source.today.seasonWeek,
      date: source.today.date.value
    }
  };
}

function mapTrainingConfiguration(
  source: SokkerApiCurrentDto["team"]["training"] | null | undefined
): CurrentClubContextDto["training"] {
  if (source === null || source === undefined) {
    throw new Error("Sokker current response is missing team.training.");
  }

  if (!isNumericTrainingConfiguration(source)) {
    const invalidPosition = (["gk", "def", "mid", "att"] as const).find(
      (position) => !Number.isFinite(source[position])
    );

    throw new Error(
      invalidPosition
        ? `Sokker current response team.training.${invalidPosition} must be a finite number.`
        : "Sokker current response team.training must contain numeric values for every position."
    );
  }

  return { GK: source.gk, DEF: source.def, MID: source.mid, ATT: source.att };
}

function isNumericTrainingConfiguration(
  source: SokkerApiCurrentDto["team"]["training"]
): source is { gk: number; def: number; mid: number; att: number } {
  return (
    source !== null &&
    source !== undefined &&
    Number.isFinite(source.gk) &&
    Number.isFinite(source.def) &&
    Number.isFinite(source.mid) &&
    Number.isFinite(source.att)
  );
}

export function mapTrainingFormationsApiToTraining(
  source: SokkerApiTrainingFormationsDto | null
): SokkerApiTeamTrainingDto {
  if (source === null || !Array.isArray(source.formations)) {
    throw new Error("Sokker training/formations response does not contain a formations array.");
  }

  const training = {
    gk: trainingValueForFormation(source, "GK"),
    def: trainingValueForFormation(source, "DEF"),
    mid: trainingValueForFormation(source, "MID"),
    att: trainingValueForFormation(source, "ATT")
  };

  if (!isNumericTrainingConfiguration(training)) {
    throw new Error(
      "Sokker training/formations response does not contain numeric values for GK, DEF, MID and ATT."
    );
  }

  return training;
}

function trainingValueForFormation(
  source: SokkerApiTrainingFormationsDto,
  formationName: "GK" | "DEF" | "MID" | "ATT"
): number | undefined {
  const formation = source.formations.find(
    (item) => item.formation.name.trim().toUpperCase() === formationName
  );

  return formation?.type.code;
}

export function mapTrainingPlayerApiToPlayer(source: SokkerApiTrainingPlayerDto): PlayerDto {
  return mapPlayerApiToPlayer(source.id, source.player);
}

export function mapPlayerApiToPlayer(
  id: number,
  player: SokkerTrainingPlayerInfoApiDto
): PlayerDto {
  return {
    id,
    teamId: player.team.id,
    name: mapName(player.name),
    country: mapCountry(player.country),
    value: mapMoney(player.value),
    wage: mapMoney(player.wage),
    age: player.characteristics.age,
    height: player.characteristics.height,
    weight: player.characteristics.weight,
    bmi: player.characteristics.bmi,
    skills: mapPlayerSkills(player.skills),
    formation: mapFormation(player.formation),
    injury: {
      daysRemaining: player.injury.daysRemaining,
      severe: player.injury.severe
    },
    cards: mapPlayerCards(player.stats),
    youthTeamId: player.youthTeamId,
    nationalCallUp: player.nationalCallUp,
    nationalType: player.nationalType
  };
}

export function mapTrainingApiToPlayers(source: SokkerApiTrainingPlayerDto[]): PlayerDto[] {
  return source.map(mapTrainingPlayerApiToPlayer);
}

export function mapTrainingPlayerApiToTrainingWeek(
  source: Pick<SokkerApiTrainingPlayerDto, "id" | "report">
): PlayerTrainingWeekDto {
  const report = source.report;
  const skills = mapPlayerSkills(report.skills);
  const skillsChange = mapSkillsChange(report.skillsChange);

  return {
    playerId: source.id,
    gameWeek: report.week,
    season: report.day.season,
    seasonWeek: report.day.seasonWeek,
    date: report.day.date.value,
    trainedSkill: mapTrainingType(report.type),
    kind: mapTrainingKind(report.kind),
    intensity: report.intensity,
    formation: mapFormation(report.formation),
    age: report.age,
    skills,
    skillsChange,
    skillChanges: deriveSkillChanges(skills, skillsChange)
  };
}

export function mapTrainingApiToTrainingWeeks(
  source: SokkerApiTrainingPlayerDto[]
): PlayerTrainingWeekDto[] {
  return source.map(mapTrainingPlayerApiToTrainingWeek);
}

export function mapTrainingApiToTrainingData(
  source: unknown,
  knownSkills?: ReadonlyMap<number, HistoricalTrainingSkills>,
  requestedSourceWeekId?: number
): TrainingDataDto {
  const players: PlayerDto[] = [];
  const trainingWeeks: PlayerTrainingWeekDto[] = [];
  const reportDiagnostics: NonNullable<TrainingDataDto["reportDiagnostics"]> = {
    receivedCount: 0,
    acceptedReportIds: [],
    discardedReportReasons: []
  };
  const reportsById = new Map<string, PlayerTrainingWeekDto>();
  const playersById = new Set<number>();
  const entries = source == null ? [] : Array.isArray(source) ? source : [source];

  for (const entry of entries) {
    const item = z
      .object({
        id: z.number().int().positive(),
        player: z.object({}).passthrough(),
        report: z.unknown().optional(),
        reports: z.unknown().optional()
      })
      .safeParse(entry);
    const rawReports = item.success
      ? [item.data.report, item.data.reports].flatMap((value) =>
          value == null ? [] : Array.isArray(value) ? value : [value]
        )
      : [null];
    // An absent report is a rejected source entry, never a fabricated training week.
    if (rawReports.length === 0) rawReports.push(null);
    for (const rawReport of rawReports) {
      reportDiagnostics.receivedCount += 1;
      const report = z
        .object({ week: z.number().int().positive() })
        .passthrough()
        .safeParse(rawReport);
      const playerId = item.success ? item.data.id : null;
      const sourceWeekId = report.success ? report.data.week : null;
      try {
        if (!item.success || !report.success) throw new Error("Invalid report shape");
        const cachedSkills =
          requestedSourceWeekId === report.data.week ? knownSkills?.get(item.data.id) : undefined;
        const rawSkills = z.object({}).catchall(z.unknown()).safeParse(report.data.skills);
        // Fill only omitted fields from factual reports of the exact same source week.
        const skills = rawSkills.success
          ? { ...cachedSkills, ...rawSkills.data }
          : report.data.skills;
        const normalizedReport = trainingPlayerSchema.shape.report.parse({
          ...report.data,
          skills
        });
        const normalizedPlayer = trainingPlayerSchema.shape.player.safeParse(item.data.player);
        if (!normalizedPlayer.success) {
          const profileSkills = z
            .record(z.string(), z.unknown())
            .safeParse(item.data.player.skills);
          const isRedactedProfile =
            profileSkills.success &&
            normalizedPlayer.error.issues.every(
              (issue) =>
                issue.path[0] === "skills" &&
                typeof issue.path[1] === "string" &&
                [
                  "stamina",
                  "keeper",
                  "playmaking",
                  "passing",
                  "technique",
                  "defending",
                  "striker",
                  "pace"
                ].includes(issue.path[1]) &&
                !Object.hasOwn(profileSkills.data, issue.path[1])
            );
          if (!isRedactedProfile) throw normalizedPlayer.error;
        }
        const player = normalizedPlayer.success
          ? mapPlayerApiToPlayer(item.data.id, normalizedPlayer.data)
          : null;
        const week = mapTrainingPlayerApiToTrainingWeek({
          id: item.data.id,
          report: normalizedReport
        });
        const key = `${week.playerId}/${week.gameWeek}`;
        const previous = reportsById.get(key);
        if (previous) {
          reportDiagnostics.discardedReportReasons.push({
            playerId,
            sourceWeekId,
            reason:
              JSON.stringify(previous) === JSON.stringify(week)
                ? "duplicate"
                : "conflicting_duplicate"
          });
          continue;
        }
        reportsById.set(key, week);
        trainingWeeks.push(week);
        reportDiagnostics.acceptedReportIds.push(key);
        if (player && !playersById.has(player.id)) {
          playersById.add(player.id);
          players.push(player);
        }
      } catch (error) {
        reportDiagnostics.discardedReportReasons.push({
          playerId,
          sourceWeekId,
          reason: "invalid_report",
          ...(error instanceof z.ZodError
            ? { fields: error.issues.map((issue) => issue.path.join(".")) }
            : {})
        });
      }
    }
  }

  return { players, trainingWeeks, reportDiagnostics };
}

export function mapTrainingKind(
  source: SokkerApiFormationDto
): "advanced" | "formation" | "missing" {
  const kindByCode: Record<number, { name: string; value: "advanced" | "formation" | "missing" }> =
    {
      1: { name: "individual", value: "advanced" },
      2: { name: "formation", value: "formation" },
      3: { name: "missing", value: "missing" }
    };
  const expected = kindByCode[source.code];

  if (!expected || source.name.trim().toLowerCase() !== expected.name) {
    throw new Error(`Unsupported Sokker training kind: ${source.code}/${source.name}.`);
  }

  return expected.value;
}

export function mapTrainingType(source: SokkerApiFormationDto): TrainingType {
  switch (source.name.trim().toLowerCase()) {
    case "general":
      return "general";
    case "stamina":
      return "stamina";
    case "keeper":
      return "keeper";
    case "playmaking":
    case "playmaker":
      return "playmaking";
    case "passing":
      return "passing";
    case "technique":
      return "technique";
    case "defending":
    case "defender":
      return "defending";
    case "striker":
    case "scoring":
      return "striker";
    case "pace":
      return "pace";
    default:
      throw new Error(`Unsupported Sokker training type: ${source.code}/${source.name}.`);
  }
}

export function mapTrainerApiToTrainer(source: SokkerTrainerApiDto): TrainerDto {
  const info = source.info;

  return {
    id: source.id,
    teamId: source.teamId,
    name: mapName(info.fullName),
    assignment: mapTrainerAssignment(info.assignment),
    contracted: info.contracted,
    salary: mapMoney(info.salary),
    age: info.age,
    skills: mapTrainerSkills(info.skills),
    averageEffectivenessPercent: info.skills.averagePercent,
    status: info.status
  };
}

export function mapTrainersApiToTrainers(source: SokkerTrainerApiDto[]): TrainerDto[] {
  return source.map(mapTrainerApiToTrainer);
}

export function mapJuniorApiToJunior(source: SokkerJuniorApiDto): JuniorDto {
  return {
    id: source.id,
    teamId: source.teamId,
    name: mapName(source.fullName),
    age: source.age,
    currentLevel: source.skill,
    weeksLeft: source.weeksLeft,
    formation: null
  };
}

export function mapJuniorsApiToJuniors(source: SokkerJuniorApiDto[]): JuniorDto[] {
  return source.map(mapJuniorApiToJunior);
}

export function mapTrainingSummaryApiToTrainingSummary(
  source: SokkerTrainingSummaryApiDto
): TrainingSummaryDto {
  return {
    weeks: source.weeks.map(mapTrainingSummaryWeek)
  };
}

function mapTrainingSummaryWeek(
  source: SokkerTrainingSummaryWeekApiDto
): TrainingSummaryDto["weeks"][number] {
  return {
    gameWeek: source.week,
    season: source.gameDay.season,
    seasonWeek: source.gameDay.seasonWeek,
    date: source.gameDay.date.value,
    players: {
      formationTraining: source.stats.general,
      advancedTraining: source.stats.advanced,
      skillsUp: source.stats.skillsUp
    },
    juniors: {
      count: source.juniors.number,
      skillsUp: source.juniors.skillsUp
    }
  };
}

function mapName(source: { name: string; surname: string; full: string }): PlayerNameDto {
  return {
    firstName: source.name,
    lastName: source.surname,
    fullName: source.full
  };
}

function mapCountry(source: { code: number; name: string }): { code: number; name: string } {
  return { code: source.code, name: source.name };
}

function mapMoney(source: { value: number; currency: string }): {
  value: number;
  currency: string;
} {
  return { value: source.value, currency: source.currency };
}

function mapPlayerCards(source: SokkerPlayerStatsApiDto | null | undefined): {
  yellow: number;
  red: number;
} {
  return {
    yellow: source?.cards?.yellow ?? 0,
    red: source?.cards?.red ?? 0
  };
}

function mapPlayerSkills(source: SokkerPlayerSkillsApiDto): PlayerSkillsDto {
  return {
    form: source.form,
    tacticalDiscipline: source.tacticalDiscipline,
    teamwork: source.teamwork,
    experience: source.experience,
    stamina: source.stamina,
    keeper: source.keeper,
    playmaking: source.playmaking,
    passing: source.passing,
    technique: source.technique,
    defending: source.defending,
    striker: source.striker,
    pace: source.pace
  };
}

function mapSkillsChange(source: SokkerSkillsChangeApiDto): PlayerSkillsChangeDto {
  return {
    ...mapPlayerSkills(source),
    up: source.up,
    down: source.down
  };
}

export function mapFormation(
  source: SokkerApiFormationDto | number | string | null | undefined
): PlayerFormation | null {
  if (source === null || source === undefined) {
    return null;
  }

  const formationByCode: Record<number, PlayerFormation> = {
    0: "GK",
    1: "DEF",
    2: "MID",
    3: "ATT"
  };

  if (typeof source === "number") {
    const formation = formationByCode[source];
    if (formation) return formation;
    throw new Error(`Unsupported Sokker player formation code: ${source}.`);
  }

  if (typeof source === "string") {
    const upper = source.trim().toUpperCase();
    if (upper === "GK" || upper === "GOALKEEPER") return "GK";
    if (upper === "DEF" || upper === "DEFENDER") return "DEF";
    if (upper === "MID" || upper === "MIDFIELDER") return "MID";
    if (upper === "ATT" || upper === "FORWARD" || upper === "STRIKER") return "ATT";
    const num = Number(source);
    if (!isNaN(num) && formationByCode[num]) return formationByCode[num];
    throw new Error(`Unsupported Sokker player formation string: ${source}.`);
  }

  const formation = formationByCode[source.code];

  if (!formation) {
    throw new Error(`Unsupported Sokker player formation: ${source.code}/${source.name}.`);
  }

  return formation;
}

function mapTrainerAssignment(source: SokkerApiFormationDto): TrainerAssignment {
  const assignmentByCode: Record<number, { name: string; value: TrainerAssignment }> = {
    1: { name: "first", value: "HEAD" },
    2: { name: "assistant", value: "ASSISTANT" },
    3: { name: "junior", value: "YOUTH" }
  };
  const assignment = assignmentByCode[source.code];

  if (!assignment || source.name.trim().toLowerCase() !== assignment.name) {
    throw new Error(`Unsupported Sokker trainer assignment: ${source.code}/${source.name}.`);
  }

  return assignment.value;
}

function mapTrainerSkills(source: SokkerTrainerInfoApiDto["skills"]): TrainerSkillsDto {
  return {
    stamina: mapTrainerSkill(source.stamina),
    keeper: mapTrainerSkill(source.keeper),
    playmaking: mapTrainerSkill(source.playmaking),
    passing: mapTrainerSkill(source.passing),
    technique: mapTrainerSkill(source.technique),
    defending: mapTrainerSkill(source.defending),
    striker: mapTrainerSkill(source.striker),
    pace: mapTrainerSkill(source.pace)
  };
}

function mapTrainerSkill(source: SokkerTrainerSkillApiDto): TrainerSkillDto {
  return {
    level: source.value,
    effectivenessPercent: source.percent
  };
}

export function mapSokkerArenaToStadiumData(raw: any): StadiumData {
  const arena = raw?.arena ?? raw;
  return {
    name: String(arena?.name || "Estadio"),
    seats: Number(arena?.seats || 0),
    seatsInProgress: Number(arena?.seatsInProgress || 0),
    weather: arena?.weather !== undefined ? Number(arena.weather) : undefined,
    pitch: {
      length: Number(arena?.pitch?.length ?? 105),
      width: Number(arena?.pitch?.width ?? 68),
      mow: Number(arena?.pitch?.mow ?? 1),
      condition: Number(arena?.pitch?.condition ?? 100),
      grassType: arena?.pitch?.grassType !== undefined ? Number(arena.pitch.grassType) : undefined,
      maintenance: arena?.pitch?.maintenance !== undefined ? Number(arena.pitch.maintenance) : undefined,
      logo: arena?.pitch?.logo
        ? {
            size: Number(arena.pitch.logo.size ?? 0),
            x: Number(arena.pitch.logo.x ?? 0),
            y: Number(arena.pitch.logo.y ?? 0)
          }
        : undefined
    },
    stands: Array.isArray(arena?.stands)
      ? arena.stands.map((s: any) => ({
          location: Number(s.location) as StandLocation,
          type: Number(s.type) as StandType,
          size: Number(s.size || 0),
          roof: Boolean(s.roof),
          ticketPrice: s.ticketPrice
            ? {
                currency: String(s.ticketPrice.currency || ""),
                value: Number(s.ticketPrice.value || 0)
              }
            : undefined,
          inConstruction: Boolean(s.inConstruction),
          constructionDays: Number(s.constructionDays || 0)
        }))
      : []
  };
}
