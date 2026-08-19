import type { TrainingKind, TrainingType } from "@atlas/domain";

import type {
  CurrentClubContextDto,
  InvalidSokkerSyncPayload,
  PlayerDto,
  PlayerFormation,
  PlayerTrainingWeekDto,
  SokkerSyncPayload,
  SokkerSyncValidationError,
  SokkerSyncValidationResult,
  SokkerSyncWarning,
  TrainerDto,
  TrainingSummaryWeekDto,
  ValidatedSokkerSyncPayload
} from "./types.js";

const MAX_SEASON_WEEK = 13;
const PLAYER_SKILL_NAMES = [
  "stamina",
  "keeper",
  "playmaking",
  "passing",
  "technique",
  "defending",
  "striker",
  "pace"
] as const;

const TRAINING_KINDS: readonly TrainingKind[] = ["advanced", "formation", "missing"];
const TRAINING_TYPES: readonly TrainingType[] = ["general", ...PLAYER_SKILL_NAMES];
const FORMATIONS: readonly PlayerFormation[] = ["GK", "DEF", "MID", "ATT"];

interface ValidationIssues {
  errors: SokkerSyncValidationError[];
  warnings: SokkerSyncWarning[];
}

export class SokkerSyncValidator {
  validate(payload: SokkerSyncPayload): SokkerSyncValidationResult {
    const issues: ValidationIssues = { errors: [], warnings: [] };
    const teamId = payload.current.team.id;

    validateCurrent(payload.current, issues);
    validatePlayers(payload.players, teamId, issues);
    validateTrainingWeeks(payload.trainingWeeks, payload.players, payload.current, issues);
    validateTrainers(payload.trainers, teamId, issues);
    validateJuniors(payload.juniors, teamId, issues);
    validateSummary(payload.trainingSummary.weeks, issues);
    validateTrainingSummaryChecksums(payload, issues);

    if (issues.errors.length > 0) {
      return invalidResult(issues);
    }

    return validResult(payload, issues.warnings);
  }
}

export function validateSokkerSyncPayload(payload: SokkerSyncPayload): SokkerSyncValidationResult {
  return new SokkerSyncValidator().validate(payload);
}

function validateCurrent(current: CurrentClubContextDto, issues: ValidationIssues): void {
  if (!isPositiveInteger(current.team.id)) {
    fatal(
      issues,
      "INVALID_TEAM_ID",
      "Current team id must be a positive integer.",
      "current.team.id"
    );
  }

  if (current.team.name.trim().length === 0) {
    fatal(issues, "EMPTY_TEAM_NAME", "Current team name must not be empty.", "current.team.name");
  }

  if (!isPositiveInteger(current.calendar.gameWeek)) {
    fatal(
      issues,
      "INVALID_CURRENT_GAME_WEEK",
      "Current calendar gameWeek must be a positive integer.",
      "current.calendar.gameWeek"
    );
  }

  if (!isPositiveInteger(current.calendar.season)) {
    fatal(
      issues,
      "INVALID_CURRENT_SEASON",
      "Current calendar season must be a positive integer.",
      "current.calendar.season"
    );
  }

  if (!isValidSeasonWeek(current.calendar.seasonWeek)) {
    fatal(
      issues,
      "INVALID_CURRENT_SEASON_WEEK",
      `Current calendar seasonWeek must be between 1 and ${MAX_SEASON_WEEK}.`,
      "current.calendar.seasonWeek"
    );
  }

  if (!Number.isFinite(current.budget.value)) {
    fatal(
      issues,
      "INVALID_BUDGET_VALUE",
      "Current budget value must be a finite number.",
      "current.budget.value"
    );
  }

  for (const position of ["GK", "DEF", "MID", "ATT"] as const) {
    if (!Number.isFinite(current.training[position])) {
      fatal(
        issues,
        "INVALID_TRAINING_CONFIGURATION",
        `Current training ${position} value must be a finite number.`,
        `current.training.${position}`
      );
    }
  }

  validateDate(current.calendar.date, "current.calendar.date", issues);
}

function validatePlayers(players: PlayerDto[], teamId: number, issues: ValidationIssues): void {
  if (players.length === 0) {
    fatal(
      issues,
      "EMPTY_PLAYER_LIST",
      "The sync payload must contain at least one player.",
      "players"
    );
  }

  const seenIds = new Set<number>();
  players.forEach((player, index) => {
    const path = `players.${index}`;

    if (!isPositiveInteger(player.id)) {
      fatal(issues, "INVALID_PLAYER_ID", "Player id must be a positive integer.", `${path}.id`);
    }

    if (seenIds.has(player.id)) {
      fatal(
        issues,
        "DUPLICATE_PLAYER_ID",
        `Player id ${player.id} appears more than once in the sync payload.`,
        `${path}.id`
      );
    }
    seenIds.add(player.id);

    validateTeamId(player.teamId, teamId, "PLAYER_TEAM_ID_MISMATCH", `${path}.teamId`, issues);
    validateFormation(player.formation, `${path}.formation`, issues);
  });
}

function validateTrainingWeeks(
  trainingWeeks: PlayerTrainingWeekDto[],
  players: PlayerDto[],
  current: CurrentClubContextDto,
  issues: ValidationIssues
): void {
  const playerIds = new Set(players.map((player) => player.id));
  const trainingPlayerIds = new Set<number>();
  const firstWeek = trainingWeeks[0];

  trainingWeeks.forEach((trainingWeek, index) => {
    const path = `trainingWeeks.${index}`;

    if (!isPositiveInteger(trainingWeek.playerId)) {
      fatal(
        issues,
        "INVALID_TRAINING_PLAYER_ID",
        "Training playerId must be a positive integer.",
        `${path}.playerId`
      );
    }

    if (trainingPlayerIds.has(trainingWeek.playerId)) {
      fatal(
        issues,
        "DUPLICATE_TRAINING_PLAYER_ID",
        `Training report for playerId ${trainingWeek.playerId} appears more than once.`,
        `${path}.playerId`
      );
    }
    trainingPlayerIds.add(trainingWeek.playerId);

    if (!playerIds.has(trainingWeek.playerId)) {
      fatal(
        issues,
        "MISSING_PLAYER_FOR_TRAINING",
        `Training report references playerId ${trainingWeek.playerId}, which is not present in players.`,
        `${path}.playerId`
      );
    }

    validateTrainingWeekShape(trainingWeek, path, issues);

    if (trainingWeek.gameWeek > current.calendar.gameWeek) {
      fatal(
        issues,
        "TRAINING_WEEK_IN_FUTURE",
        `Training week ${trainingWeek.gameWeek} is after current gameWeek ${current.calendar.gameWeek}.`,
        `${path}.gameWeek`
      );
    }

    if (firstWeek !== undefined && !sameTrainingWeek(firstWeek, trainingWeek)) {
      fatal(
        issues,
        "INCONSISTENT_TRAINING_WEEK",
        "All training reports in one sync must describe the same gameWeek, season, seasonWeek and date.",
        path
      );
    }
  });

  for (const playerId of playerIds) {
    if (!trainingPlayerIds.has(playerId)) {
      fatal(
        issues,
        "MISSING_TRAINING_REPORT",
        `Player ${playerId} has no training report in the sync payload.`,
        "trainingWeeks"
      );
    }
  }
}

function validateTrainingWeekShape(
  trainingWeek: PlayerTrainingWeekDto,
  path: string,
  issues: ValidationIssues
): void {
  if (!isPositiveInteger(trainingWeek.gameWeek)) {
    fatal(
      issues,
      "INVALID_TRAINING_GAME_WEEK",
      "Training gameWeek must be a positive integer.",
      `${path}.gameWeek`
    );
  }

  if (!isPositiveInteger(trainingWeek.season)) {
    fatal(
      issues,
      "INVALID_TRAINING_SEASON",
      "Training season must be a positive integer.",
      `${path}.season`
    );
  }

  if (!isValidSeasonWeek(trainingWeek.seasonWeek)) {
    fatal(
      issues,
      "INVALID_TRAINING_SEASON_WEEK",
      `Training seasonWeek must be between 1 and ${MAX_SEASON_WEEK}.`,
      `${path}.seasonWeek`
    );
  }

  validateDate(trainingWeek.date, `${path}.date`, issues);

  if (!TRAINING_TYPES.includes(trainingWeek.trainedSkill)) {
    fatal(
      issues,
      "INVALID_TRAINING_TYPE",
      `Training type ${String(trainingWeek.trainedSkill)} is not supported.`,
      `${path}.trainedSkill`
    );
  }

  if (!TRAINING_KINDS.includes(trainingWeek.kind)) {
    fatal(
      issues,
      "INVALID_TRAINING_KIND",
      `Training kind ${String(trainingWeek.kind)} is not supported.`,
      `${path}.kind`
    );
  }

  if (
    !Number.isFinite(trainingWeek.intensity) ||
    trainingWeek.intensity < 0 ||
    trainingWeek.intensity > 100
  ) {
    fatal(
      issues,
      "INVALID_TRAINING_INTENSITY",
      "Training intensity must be between 0 and 100.",
      `${path}.intensity`
    );
  }

  validateFormation(trainingWeek.formation, `${path}.formation`, issues);
  validateSkillsChange(trainingWeek, path, issues);

  if (trainingWeek.kind === "missing" && trainingWeek.intensity > 0) {
    warning(
      issues,
      "MISSING_TRAINING_WITH_INTENSITY",
      "A missing training report has a non-zero intensity; this is retained as a warning until Sokker semantics are confirmed.",
      `${path}.intensity`
    );
  }
}

function validateSkillsChange(
  trainingWeek: PlayerTrainingWeekDto,
  path: string,
  issues: ValidationIssues
): void {
  const { up, down } = trainingWeek.skillsChange;
  if (!Number.isFinite(up) || up < 0) {
    fatal(
      issues,
      "INVALID_SKILLS_CHANGE_UP",
      "skillsChange.up must be a non-negative number.",
      `${path}.skillsChange.up`
    );
  }
  if (!Number.isFinite(down) || down < 0) {
    fatal(
      issues,
      "INVALID_SKILLS_CHANGE_DOWN",
      "skillsChange.down must be a non-negative number.",
      `${path}.skillsChange.down`
    );
  }

  if (Number.isFinite(up) && Number.isFinite(down)) {
    const positiveDeltas = PLAYER_SKILL_NAMES.filter(
      (skill) => trainingWeek.skillsChange[skill] > 0
    ).length;
    const negativeDeltas = PLAYER_SKILL_NAMES.filter(
      (skill) => trainingWeek.skillsChange[skill] < 0
    ).length;

    if (positiveDeltas !== up || negativeDeltas !== down) {
      warning(
        issues,
        "SKILLS_CHANGE_COUNTER_MISMATCH",
        `skillsChange counters report ${up} up and ${down} down, while core skill deltas contain ${positiveDeltas} up and ${negativeDeltas} down.`,
        `${path}.skillsChange`
      );
    }
  }
}

function validateTrainers(trainers: TrainerDto[], teamId: number, issues: ValidationIssues): void {
  const seenIds = new Set<number>();
  let headCount = 0;
  let youthCount = 0;

  trainers.forEach((trainer, index) => {
    const path = `trainers.${index}`;
    if (!isPositiveInteger(trainer.id)) {
      fatal(issues, "INVALID_TRAINER_ID", "Trainer id must be a positive integer.", `${path}.id`);
    }
    if (seenIds.has(trainer.id)) {
      fatal(
        issues,
        "DUPLICATE_TRAINER_ID",
        `Trainer id ${trainer.id} appears more than once in the sync payload.`,
        `${path}.id`
      );
    }
    seenIds.add(trainer.id);

    validateTeamId(trainer.teamId, teamId, "TRAINER_TEAM_ID_MISMATCH", `${path}.teamId`, issues);

    if (trainer.assignment === "HEAD") {
      headCount += 1;
    } else if (trainer.assignment === "YOUTH") {
      youthCount += 1;
    } else if (trainer.assignment !== "ASSISTANT") {
      fatal(
        issues,
        "INVALID_TRAINER_ASSIGNMENT",
        `Trainer assignment ${String(trainer.assignment)} is not supported.`,
        `${path}.assignment`
      );
    }

    if (
      !Number.isFinite(trainer.averageEffectivenessPercent) ||
      trainer.averageEffectivenessPercent < 0 ||
      trainer.averageEffectivenessPercent > 100
    ) {
      fatal(
        issues,
        "INVALID_TRAINER_AVERAGE_EFFECTIVENESS",
        "Trainer averageEffectivenessPercent must be between 0 and 100.",
        `${path}.averageEffectivenessPercent`
      );
    }

    PLAYER_SKILL_NAMES.forEach((skill) => {
      const trainerSkill = trainer.skills[skill];
      if (!Number.isFinite(trainerSkill.level)) {
        fatal(
          issues,
          "INVALID_TRAINER_SKILL_LEVEL",
          `Trainer skill ${skill} level must be a finite number.`,
          `${path}.skills.${skill}.level`
        );
      }
      if (
        !Number.isFinite(trainerSkill.effectivenessPercent) ||
        trainerSkill.effectivenessPercent < 0 ||
        trainerSkill.effectivenessPercent > 100
      ) {
        fatal(
          issues,
          "INVALID_TRAINER_SKILL_EFFECTIVENESS",
          `Trainer skill ${skill} effectivenessPercent must be between 0 and 100.`,
          `${path}.skills.${skill}.effectivenessPercent`
        );
      }
    });
  });

  if (headCount > 1) {
    fatal(
      issues,
      "MULTIPLE_HEAD_TRAINERS",
      "The sync payload contains more than one HEAD trainer.",
      "trainers"
    );
  } else if (headCount === 0) {
    warning(
      issues,
      "MISSING_HEAD_TRAINER",
      "The sync payload contains no HEAD trainer.",
      "trainers"
    );
  }

  if (youthCount > 1) {
    fatal(
      issues,
      "MULTIPLE_YOUTH_TRAINERS",
      "The sync payload contains more than one YOUTH trainer.",
      "trainers"
    );
  }
}

function validateJuniors(
  juniors: SokkerSyncPayload["juniors"],
  teamId: number,
  issues: ValidationIssues
): void {
  if (juniors.length === 0) {
    warning(
      issues,
      "EMPTY_JUNIOR_LIST",
      "The sync payload contains no current juniors.",
      "juniors"
    );
  }

  const seenIds = new Set<number>();
  juniors.forEach((junior, index) => {
    const path = `juniors.${index}`;
    if (!isPositiveInteger(junior.id)) {
      fatal(issues, "INVALID_JUNIOR_ID", "Junior id must be a positive integer.", `${path}.id`);
    }
    if (seenIds.has(junior.id)) {
      fatal(
        issues,
        "DUPLICATE_JUNIOR_ID",
        `Junior id ${junior.id} appears more than once in the sync payload.`,
        `${path}.id`
      );
    }
    seenIds.add(junior.id);
    validateTeamId(junior.teamId, teamId, "JUNIOR_TEAM_ID_MISMATCH", `${path}.teamId`, issues);
  });
}

function validateSummary(weeks: TrainingSummaryWeekDto[], issues: ValidationIssues): void {
  const seenWeeks = new Set<number>();
  weeks.forEach((week, index) => {
    const path = `trainingSummary.weeks.${index}`;
    if (!isPositiveInteger(week.gameWeek)) {
      fatal(
        issues,
        "INVALID_SUMMARY_GAME_WEEK",
        "Summary gameWeek must be a positive integer.",
        `${path}.gameWeek`
      );
    }
    if (seenWeeks.has(week.gameWeek)) {
      fatal(
        issues,
        "DUPLICATE_SUMMARY_WEEK",
        `Training summary gameWeek ${week.gameWeek} appears more than once.`,
        `${path}.gameWeek`
      );
    }
    seenWeeks.add(week.gameWeek);

    if (!isPositiveInteger(week.season)) {
      fatal(
        issues,
        "INVALID_SUMMARY_SEASON",
        "Summary season must be a positive integer.",
        `${path}.season`
      );
    }
    if (!isValidSeasonWeek(week.seasonWeek)) {
      fatal(
        issues,
        "INVALID_SUMMARY_SEASON_WEEK",
        `Summary seasonWeek must be between 1 and ${MAX_SEASON_WEEK}.`,
        `${path}.seasonWeek`
      );
    }
    validateDate(week.date, `${path}.date`, issues);

    validateNonNegativeNumber(
      week.players.formationTraining,
      `${path}.players.formationTraining`,
      "INVALID_SUMMARY_COUNT",
      issues
    );
    validateNonNegativeNumber(
      week.players.advancedTraining,
      `${path}.players.advancedTraining`,
      "INVALID_SUMMARY_COUNT",
      issues
    );
    validateNonNegativeNumber(
      week.players.skillsUp,
      `${path}.players.skillsUp`,
      "INVALID_SUMMARY_COUNT",
      issues
    );
    validateNonNegativeNumber(
      week.juniors.count,
      `${path}.juniors.count`,
      "INVALID_SUMMARY_COUNT",
      issues
    );
    validateNonNegativeNumber(
      week.juniors.skillsUp,
      `${path}.juniors.skillsUp`,
      "INVALID_SUMMARY_COUNT",
      issues
    );
  });
}

function validateTrainingSummaryChecksums(
  payload: SokkerSyncPayload,
  issues: ValidationIssues
): void {
  const firstTrainingWeek = payload.trainingWeeks[0];
  if (firstTrainingWeek === undefined) {
    return;
  }

  const summaryWeek = payload.trainingSummary.weeks.find(
    (week) => week.gameWeek === firstTrainingWeek.gameWeek
  );
  if (summaryWeek === undefined) {
    fatal(
      issues,
      "SUMMARY_WEEK_NOT_FOUND",
      `Training summary does not contain the report week ${firstTrainingWeek.gameWeek}.`,
      "trainingSummary.weeks"
    );
    return;
  }

  const advancedCount = payload.trainingWeeks.filter((week) => week.kind === "advanced").length;
  const formationCount = payload.trainingWeeks.filter((week) => week.kind === "formation").length;
  const missingCount = payload.trainingWeeks.filter((week) => week.kind === "missing").length;

  if (advancedCount !== summaryWeek.players.advancedTraining) {
    fatal(
      issues,
      "SUMMARY_ADVANCED_MISMATCH",
      `Training summary mismatch for week ${firstTrainingWeek.gameWeek}: expected ${advancedCount} advanced reports, summary reports ${summaryWeek.players.advancedTraining}.`,
      "trainingSummary.weeks"
    );
  }
  if (formationCount !== summaryWeek.players.formationTraining) {
    fatal(
      issues,
      "SUMMARY_FORMATION_MISMATCH",
      `Training summary mismatch for week ${firstTrainingWeek.gameWeek}: expected ${formationCount} formation reports, summary reports ${summaryWeek.players.formationTraining}.`,
      "trainingSummary.weeks"
    );
  }
  if (advancedCount + formationCount + missingCount !== payload.trainingWeeks.length) {
    fatal(
      issues,
      "TRAINING_KIND_COUNT_MISMATCH",
      "Training kind counts do not account for every training report.",
      "trainingWeeks"
    );
  }

  const skillsUp = payload.trainingWeeks.reduce((total, week) => total + week.skillsChange.up, 0);
  if (skillsUp !== summaryWeek.players.skillsUp) {
    fatal(
      issues,
      "SUMMARY_SKILL_UP_MISMATCH",
      `Training summary mismatch for week ${firstTrainingWeek.gameWeek}: expected ${skillsUp} skill ups, summary reports ${summaryWeek.players.skillsUp}.`,
      "trainingSummary.weeks"
    );
  }
}

function validateTeamId(
  actualTeamId: number,
  expectedTeamId: number,
  code: string,
  path: string,
  issues: ValidationIssues
): void {
  if (actualTeamId !== expectedTeamId) {
    fatal(
      issues,
      code,
      `Record belongs to team ${actualTeamId}, but the sync context belongs to team ${expectedTeamId}.`,
      path,
      { expectedTeamId, actualTeamId }
    );
  }
}

function validateFormation(
  formation: PlayerFormation | null,
  path: string,
  issues: ValidationIssues
): void {
  if (formation !== null && !FORMATIONS.includes(formation)) {
    fatal(issues, "INVALID_FORMATION", `Formation ${String(formation)} is not supported.`, path);
  }
}

function validateDate(value: string, path: string, issues: ValidationIssues): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    fatal(
      issues,
      "INVALID_GAME_DATE",
      `Date ${String(value)} must use the YYYY-MM-DD game date format.`,
      path
    );
    return;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    fatal(issues, `INVALID_GAME_DATE`, `Date ${value} is not a valid calendar date.`, path);
  }
}

function validateNonNegativeNumber(
  value: number,
  path: string,
  code: string,
  issues: ValidationIssues
): void {
  if (!Number.isFinite(value) || value < 0) {
    fatal(issues, code, `Value at ${path} must be a non-negative number.`, path);
  }
}

function sameTrainingWeek(first: PlayerTrainingWeekDto, candidate: PlayerTrainingWeekDto): boolean {
  return (
    first.gameWeek === candidate.gameWeek &&
    first.season === candidate.season &&
    first.seasonWeek === candidate.seasonWeek &&
    first.date === candidate.date
  );
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isValidSeasonWeek(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_SEASON_WEEK;
}

function fatal(
  issues: ValidationIssues,
  code: string,
  message: string,
  path?: string,
  details?: Record<string, unknown>
): void {
  issues.errors.push({ severity: "fatal", code, message, path, details });
}

function warning(
  issues: ValidationIssues,
  code: string,
  message: string,
  path?: string,
  details?: Record<string, unknown>
): void {
  issues.warnings.push({ severity: "warning", code, message, path, details });
}

function validResult(
  payload: SokkerSyncPayload,
  warnings: SokkerSyncWarning[]
): ValidatedSokkerSyncPayload {
  return { status: "valid", payload, warnings };
}

function invalidResult(issues: ValidationIssues): InvalidSokkerSyncPayload {
  return { status: "invalid", payload: null, errors: issues.errors, warnings: issues.warnings };
}
