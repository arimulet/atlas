import { normalizeSeasonWeek } from "@atlas/domain";

import type {
  SokkerCountryDto,
  SokkerCurrentDto,
  SokkerJuniorDto,
  PlayerTrainingWeekDto,
  SokkerPlayerDto,
  SokkerTeamDto
} from "../../types.js";
import type {
  SokkerApiCountryDto,
  SokkerApiCurrentDto,
  SokkerApiJuniorDto,
  SokkerApiPlayerDto,
  SokkerApiTeamDto,
  SokkerApiTrainingPlayerDto,
  SokkerApiTrainingReportDto
} from "./dtos.js";

export function mapApiCurrentToSokkerCurrentDto(input: SokkerApiCurrentDto): SokkerCurrentDto {
  return {
    gameWeek: input.gameWeek,
    week: normalizeSeasonWeek(input.gameWeek),
    season: input.season,
    teamId: input.teamId
  };
}

export function mapApiTeamToSokkerTeamDto(input: SokkerApiTeamDto): SokkerTeamDto {
  return {
    id: input.id,
    name: input.name,
    countryId: input.countryId,
    money: { amount: input.money, currency: null },
    season: input.season,
    training: {
      gk: input.training.gk ?? null,
      def: input.training.def ?? null,
      mid: input.training.mid ?? null,
      att: input.training.att ?? null
    }
  };
}

export function mapApiPlayerToSokkerPlayerDto(input: SokkerApiPlayerDto): SokkerPlayerDto {
  return {
    playerId: input.playerId,
    name: input.name,
    age: input.age,
    wage: input.wage,
    value: input.value,
    training: input.training,
    form: input.form ?? 10,
    availabilityStatus: "available",
    observedPosition: null,
    skills: {
      stamina: input.skills.stamina,
      pace: input.skills.pace,
      technique: input.skills.technique,
      passing: input.skills.passing,
      keeper: input.skills.keeper,
      defender: input.skills.defender,
      playmaker: input.skills.playmaker,
      striker: input.skills.striker
    }
  };
}

export function mapApiJuniorToSokkerJuniorDto(input: SokkerApiJuniorDto): SokkerJuniorDto {
  return {
    playerId: input.playerId,
    name: input.name,
    age: input.age,
    initialWeeksRemaining: input.weeksRemaining,
    weeksRemaining: input.weeksRemaining,
    skill: input.skill,
    status: "in_academy"
  };
}

export function mapApiCountryToSokkerCountryDto(input: SokkerApiCountryDto): SokkerCountryDto {
  return input;
}

export function mapApiTrainingPlayerToPlayerTrainingWeekDto(
  input: SokkerApiTrainingPlayerDto
): PlayerTrainingWeekDto {
  const report = input.report;

  return {
    playerId: input.id,
    gameWeek: report.day.week,
    seasonWeek: report.day.seasonWeek,
    date: mapTrainingDate(report),
    type: mapTrainingType(report.type.name),
    kind: mapTrainingKind(report.kind.name),
    intensity: report.intensity,
    age: report.age,
    skills: mapSkills(report.skills),
    skillsChange: mapSkillsChange(report.skillsChange)
  };
}

export function mapTrainingKind(name: string): "advanced" | "formation" | "missing" {
  switch (name.trim().toLowerCase()) {
    case "individual":
      return "advanced";
    case "formation":
      return "formation";
    case "missing":
      return "missing";
    default:
      throw new Error(`Unsupported Sokker training kind: ${name}.`);
  }
}

export function mapTrainingType(name: string):
  | "general"
  | "stamina"
  | "keeper"
  | "playmaking"
  | "passing"
  | "technique"
  | "defending"
  | "striker"
  | "pace" {
  switch (name.trim().toLowerCase()) {
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
      throw new Error(`Unsupported Sokker training type: ${name}.`);
  }
}

function mapTrainingDate(report: SokkerApiTrainingReportDto): Date {
  const timestamp = report.day.date.timestamp;
  if (timestamp !== undefined) {
    const date = new Date(timestamp * 1000);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const date = new Date(report.day.date.value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Sokker training date: ${report.day.date.value}.`);
  }

  return date;
}

function mapSkills(input: SokkerApiTrainingReportDto["skills"]): PlayerTrainingWeekDto["skills"] {
  return {
    stamina: input.stamina,
    keeper: input.keeper,
    playmaking: input.playmaking,
    passing: input.passing,
    technique: input.technique,
    defending: input.defending,
    striker: input.striker,
    pace: input.pace
  };
}

function mapSkillsChange(
  input: SokkerApiTrainingReportDto["skillsChange"]
): PlayerTrainingWeekDto["skillsChange"] {
  return {
    stamina: input.stamina ?? 0,
    keeper: input.keeper ?? 0,
    playmaking: input.playmaking ?? 0,
    passing: input.passing ?? 0,
    technique: input.technique ?? 0,
    defending: input.defending ?? 0,
    striker: input.striker ?? 0,
    pace: input.pace ?? 0,
    up: input.up,
    down: input.down
  };
}
