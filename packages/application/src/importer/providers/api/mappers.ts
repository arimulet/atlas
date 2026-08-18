import { calculateGameWeek, deriveSkillChanges, normalizeSeasonWeek } from "@atlas/domain";

import type {
  SokkerClubProfileDto,
  SokkerCurrentDto,
  SokkerJuniorDto,
  PlayerTrainingWeekDto,
  SokkerPlayerDto
} from "../../types.js";
import type {
  SokkerApiCurrentDto,
  SokkerApiJuniorDto,
  SokkerApiTrainingPlayerDto,
  SokkerApiTrainingReportDto,
  SokkerPlayerSkillsApiDto,
  SokkerSkillsChangeApiDto
} from "./dtos.js";

export function mapApiCurrentToSokkerCurrentDto(input: SokkerApiCurrentDto): SokkerCurrentDto {
  const gameWeek =
    input.today.week >= 977
      ? input.today.week
      : calculateGameWeek(input.today.season, input.today.seasonWeek);

  return {
    gameWeek,
    week: normalizeSeasonWeek(gameWeek),
    season: input.today.season,
    teamId: input.team.id
  };
}

export function mapApiCurrentToClubProfile(input: SokkerApiCurrentDto): SokkerClubProfileDto {
  const current = mapApiCurrentToSokkerCurrentDto(input);

  return {
    externalId: String(input.team.id),
    name: input.team.name,
    countryId: input.team.country.code,
    money: {
      amount: input.budget.value,
      currency: input.budget.currency
    },
    season: current.season,
    gameWeek: current.gameWeek,
    week: current.week,
    training: null
  };
}

export function mapApiTrainingPlayerToSokkerPlayerDto(
  input: SokkerApiTrainingPlayerDto
): SokkerPlayerDto {
  const player = input.player;

  return {
    playerId: input.id,
    name: player.name.full,
    age: player.characteristics.age,
    wage: player.wage.value,
    value: player.value.value,
    training: {
      position: player.formation?.code ?? 0,
      advanced: input.report.kind.name.trim().toLowerCase() === "individual"
    },
    form: player.skills.form,
    availabilityStatus: player.injury.daysRemaining > 0 ? "injured" : "available",
    observedPosition: null,
    skills: mapPlayerSkills(player.skills)
  };
}

export function mapApiJuniorToSokkerJuniorDto(input: SokkerApiJuniorDto): SokkerJuniorDto {
  return {
    playerId: input.id,
    name: input.name,
    age: input.age,
    initialWeeksRemaining: input.weeksLeft,
    weeksRemaining: input.weeksLeft,
    skill: input.skill,
    status: "in_academy"
  };
}

export function mapApiTrainingPlayerToPlayerTrainingWeekDto(
  input: SokkerApiTrainingPlayerDto
): PlayerTrainingWeekDto {
  const report = input.report;
  const skills = mapTrainingSkills(report.skills);
  const skillsChange = mapSkillsChange(report.skillsChange);

  return {
    playerId: input.id,
    gameWeek: report.day.week,
    season: report.day.season,
    seasonWeek: report.day.seasonWeek,
    date: new Date(report.day.date.timestamp * 1000),
    type: mapTrainingType(report.type.name),
    kind: mapTrainingKind(report.kind.name),
    intensity: report.intensity,
    age: report.age,
    skills,
    skillsChange,
    skillChanges: deriveSkillChanges(skills, skillsChange)
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

export function mapTrainingType(
  name: string
):
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

function mapPlayerSkills(input: SokkerPlayerSkillsApiDto): SokkerPlayerDto["skills"] {
  return {
    stamina: input.stamina,
    pace: input.pace,
    technique: input.technique,
    passing: input.passing,
    keeper: input.keeper,
    defender: input.defending,
    playmaker: input.playmaking,
    striker: input.striker
  };
}

function mapTrainingSkills(input: SokkerPlayerSkillsApiDto): PlayerTrainingWeekDto["skills"] {
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

function mapSkillsChange(input: SokkerSkillsChangeApiDto): PlayerTrainingWeekDto["skillsChange"] {
  return {
    stamina: input.stamina,
    keeper: input.keeper,
    playmaking: input.playmaking,
    passing: input.passing,
    technique: input.technique,
    defending: input.defending,
    striker: input.striker,
    pace: input.pace,
    up: input.up,
    down: input.down
  };
}

export type SokkerTrainingReportApiContract = SokkerApiTrainingReportDto;
