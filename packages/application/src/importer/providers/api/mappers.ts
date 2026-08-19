import { deriveSkillChanges } from "@atlas/domain";
import type {
  CurrentClubContextDto,
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
  SokkerApiTrainingPlayerDto,
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
    calendar: {
      season: source.today.season,
      gameWeek: source.today.week,
      seasonWeek: source.today.seasonWeek,
      date: source.today.date.value
    }
  };
}

export function mapTrainingPlayerApiToPlayer(source: SokkerApiTrainingPlayerDto): PlayerDto {
  const player = source.player;

  return {
    id: source.id,
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
  source: SokkerApiTrainingPlayerDto
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
  source: SokkerApiTrainingPlayerDto[]
): TrainingDataDto {
  const players: PlayerDto[] = [];
  const trainingWeeks: PlayerTrainingWeekDto[] = [];

  for (const item of source) {
    players.push(mapTrainingPlayerApiToPlayer(item));
    trainingWeeks.push(mapTrainingPlayerApiToTrainingWeek(item));
  }

  return { players, trainingWeeks };
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
    weeksLeft: source.weeksLeft
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

function mapFormation(source: SokkerApiFormationDto | null): PlayerFormation | null {
  if (source === null) {
    return null;
  }

  const formationByCode: Record<number, PlayerFormation> = {
    0: "GK",
    1: "DEF",
    2: "MID",
    3: "ATT"
  };
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
