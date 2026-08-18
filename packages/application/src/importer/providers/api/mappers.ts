import { calculateGameWeek, deriveSkillChanges, normalizeSeasonWeek } from "@atlas/domain";

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
  const gameWeek = resolveGameWeek(input);

  return {
    gameWeek,
    week: normalizeSeasonWeek(gameWeek),
    season: findFirstNumber(input, ["season"]),
    teamId: resolveTeamId(input)
  };
}

export function mapApiTeamToSokkerTeamDto(input: SokkerApiTeamDto): SokkerTeamDto {
  const training = findRecordByKeys(input, ["training"]);

  return {
    id: requireExternalNumber(input, ["id", "teamId"], "team id"),
    name: requireExternalString(input, "name", "team name"),
    countryId: requireExternalNumber(
      input,
      ["countryId", "country_id"],
      "team country id",
      ["country", "nation", "nationality", "countryInfo"]
    ),
    money: { amount: findPlayerMoney(input, ["money", "balance", "cash"]) ?? 0, currency: null },
    season: findFirstNumber(input, ["season"]),
    training: {
      gk: findFirstNumber(training, ["gk", "keeper", "goalkeeper"]) ?? null,
      def: findFirstNumber(training, ["def", "defender", "defending"]) ?? null,
      mid: findFirstNumber(training, ["mid", "midfielder", "playmaker"]) ?? null,
      att: findFirstNumber(training, ["att", "attacker", "striker"]) ?? null
    }
  };
}

export function mapApiPlayerToSokkerPlayerDto(input: SokkerApiPlayerDto): SokkerPlayerDto {
  const skills = resolvePlayerSkills(input);

  return {
    playerId: requireExternalNumber(input, ["playerId", "id"], "playerId"),
    name: requireExternalString(input, "name", "player name"),
    age: requireExternalNumber(input, ["age"], "player age"),
    wage: readPlayerWage(input),
    value: requireExternalNumber(input, ["value"], "player value"),
    training: resolvePlayerTraining(input),
    form: findFirstNumber(input, ["form"]) ?? 10,
    availabilityStatus: "available",
    observedPosition: null,
    skills: {
      stamina: readPlayerSkill(skills, ["stamina"]),
      pace: readPlayerSkill(skills, ["pace"]),
      technique: readPlayerSkill(skills, ["technique"]),
      passing: readPlayerSkill(skills, ["passing"]),
      keeper: readPlayerSkill(skills, ["keeper", "goalkeeper"]),
      defender: readPlayerSkill(skills, ["defender", "defending"]),
      playmaker: readPlayerSkill(skills, ["playmaker", "playmaking"]),
      striker: readPlayerSkill(skills, ["striker", "scoring"])
    }
  };
}

export function mapApiJuniorToSokkerJuniorDto(input: SokkerApiJuniorDto): SokkerJuniorDto {
  const weeksRemaining = findFirstNumber(input, [
    "weeksRemaining",
    "weeks",
    "weeksLeft",
    "remainingWeeks"
  ]);

  return {
    playerId: requireExternalNumber(input, ["playerId", "id"], "junior playerId"),
    name: requireExternalString(input, "name", "junior name"),
    age: requireExternalNumber(input, ["age"], "junior age"),
    initialWeeksRemaining: weeksRemaining ?? null,
    weeksRemaining: weeksRemaining ?? null,
    skill: findFirstNumber(input, ["skill", "generalSkill", "level"]) ?? 0,
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

  const skills = mapSkills(report.skills);
  const skillsChange = mapSkillsChange(report.skillsChange);

  return {
    playerId: input.id,
    gameWeek: report.day.week,
    season: report.day.season,
    seasonWeek: report.day.seasonWeek,
    date: mapTrainingDate(report),
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

function resolvePlayerSkills(input: SokkerApiPlayerDto): unknown {
  return findRecordByKeys(input, ["skills", "skill"]) ?? input;
}

function resolvePlayerTraining(input: SokkerApiPlayerDto): { position: number; advanced: boolean } {
  const training = findRecordByKeys(input, ["training", "formation"]);
  const position = training
    ? findFirstNumber(training, ["position", "code"]) ?? 0
    : findFirstNumber(input, ["position"]) ?? 0;
  const advanced = training ? readBooleanProperty(training, "advanced") ?? false : false;

  return { position, advanced };
}

function readPlayerSkill(input: unknown, keys: readonly string[]): number | null {
  return findFirstNumber(input, keys) ?? null;
}

function readPlayerWage(input: SokkerApiPlayerDto): number {
  return (
    findPlayerMoney(input, [
      "wage",
      "salary",
      "weeklyWage",
      "weeklySalary",
      "wageValue",
      "salaryValue",
      "contractWage",
      "pay"
    ]) ?? 0
  );
}

function findPlayerMoney(input: unknown, keys: readonly string[]): number | undefined {
  const visited = new Set<object>();
  return findMoney(input, new Set(keys), visited);
}

function findMoney(
  input: unknown,
  keys: ReadonlySet<string>,
  visited: Set<object>
): number | undefined {
  if (!isRecord(input) || visited.has(input)) {
    return undefined;
  }

  visited.add(input);

  for (const [key, value] of Object.entries(input)) {
    if (!keys.has(key)) {
      continue;
    }

    const amount = readMoneyValue(value);
    if (amount !== undefined) {
      return amount;
    }
  }

  for (const value of Object.values(input)) {
    const amount = findMoney(value, keys, visited);
    if (amount !== undefined) {
      return amount;
    }
  }

  return undefined;
}

function readMoneyValue(input: unknown): number | undefined {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }

  if (typeof input === "string") {
    const normalized = input.trim().replace(/,/g, "");
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : undefined;
  }

  if (!isRecord(input)) {
    return undefined;
  }

  for (const key of ["amount", "value", "number", "raw"]) {
    const amount = readMoneyValue(input[key]);
    if (amount !== undefined) {
      return amount;
    }
  }

  return undefined;
}

function requireExternalNumber(
  input: unknown,
  keys: readonly string[],
  fieldName: string,
  objectKeys: readonly string[] = []
): number {
  const value = keys
    .map((key) => readNumberProperty(input, key))
    .find((candidate) => candidate !== undefined);

  if (value !== undefined) {
    return value;
  }

  const nestedValue = findFirstNumber(input, keys);
  if (nestedValue !== undefined) {
    return nestedValue;
  }

  const objectValue = findObjectId(input, objectKeys);
  if (objectValue !== undefined) {
    return objectValue;
  }

  throw new Error(`Sokker response did not provide ${fieldName}.`);
}

function findObjectId(input: unknown, keys: readonly string[]): number | undefined {
  if (keys.length === 0) {
    return undefined;
  }

  const visited = new Set<object>();
  return findNestedObjectId(input, new Set(keys), visited);
}

function findNestedObjectId(
  input: unknown,
  keys: ReadonlySet<string>,
  visited: Set<object>
): number | undefined {
  if (!isRecord(input) || visited.has(input)) {
    return undefined;
  }

  visited.add(input);

  for (const [key, value] of Object.entries(input)) {
    if (!keys.has(key)) {
      continue;
    }

    if (typeof value === "number") {
      return value;
    }

    if (isRecord(value) && typeof value.id === "number") {
      return value.id;
    }
  }

  for (const value of Object.values(input)) {
    const id = findNestedObjectId(value, keys, visited);
    if (id !== undefined) {
      return id;
    }
  }

  return undefined;
}

function requireExternalString(input: unknown, key: string, fieldName: string): string {
  const value = readStringProperty(input, key) ?? findFirstString(input, [key]);
  if (value !== undefined) {
    return value;
  }

  throw new Error(`Sokker response did not provide ${fieldName}.`);
}

function findRecordByKeys(input: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!isRecord(input)) {
    return null;
  }

  const visited = new Set<object>();
  return findRecord(input, new Set(keys), visited);
}

function findRecord(
  input: unknown,
  keys: ReadonlySet<string>,
  visited: Set<object>
): Record<string, unknown> | null {
  if (!isRecord(input) || visited.has(input)) {
    return null;
  }

  visited.add(input);

  for (const [key, value] of Object.entries(input)) {
    if (keys.has(key) && isRecord(value)) {
      return value;
    }
  }

  for (const value of Object.values(input)) {
    const record = findRecord(value, keys, visited);
    if (record) {
      return record;
    }
  }

  return null;
}

function findFirstString(input: unknown, keys: readonly string[]): string | undefined {
  if (!isRecord(input)) {
    return undefined;
  }

  const visited = new Set<object>();
  return findString(input, new Set(keys), visited);
}

function findString(
  input: unknown,
  keys: ReadonlySet<string>,
  visited: Set<object>
): string | undefined {
  if (!isRecord(input) || visited.has(input)) {
    return undefined;
  }

  visited.add(input);

  for (const [key, value] of Object.entries(input)) {
    if (keys.has(key) && typeof value === "string") {
      return value;
    }
  }

  for (const value of Object.values(input)) {
    const stringValue = findString(value, keys, visited);
    if (stringValue !== undefined) {
      return stringValue;
    }
  }

  return undefined;
}

function readNumberProperty(input: unknown, key: string): number | undefined {
  if (!isRecord(input)) {
    return undefined;
  }

  const value = input[key];
  return typeof value === "number" ? value : undefined;
}

function readStringProperty(input: unknown, key: string): string | undefined {
  if (!isRecord(input)) {
    return undefined;
  }

  const value = input[key];
  return typeof value === "string" ? value : undefined;
}

function readBooleanProperty(input: unknown, key: string): boolean | undefined {
  if (!isRecord(input)) {
    return undefined;
  }

  const value = input[key];
  return typeof value === "boolean" ? value : undefined;
}

function resolveGameWeek(input: SokkerApiCurrentDto): number {
  const gameWeeks = findNumbers(input, [
    "gameWeek",
    "gameweek",
    "game_week",
    "currentGameWeek",
    "current_game_week"
  ]);
  const absoluteGameWeek = gameWeeks.find(isSupportedGameWeek);
  if (absoluteGameWeek !== undefined) {
    return absoluteGameWeek;
  }

  const weeks = findNumbers(input, ["week", "currentWeek", "current_week"]);
  const absoluteWeek = weeks.find(isSupportedGameWeek);
  if (absoluteWeek !== undefined) {
    return absoluteWeek;
  }

  const season = findFirstNumber(input, ["season", "currentSeason", "current_season"]);
  if (season !== undefined) {
    const seasonWeek = findFirstNumber(input, ["seasonWeek", "season_week"]) ?? weeks[0];
    if (seasonWeek !== undefined) {
      return calculateGameWeek(season, seasonWeek);
    }
  }

  throw new Error(
    "Sokker current response did not provide a supported game week or season/week pair."
  );
}

function isSupportedGameWeek(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value >= 977;
}

function resolveTeamId(input: SokkerApiCurrentDto): number | undefined {
  const explicitTeamId = findFirstNumber(input, ["teamId", "team_id"]);
  if (explicitTeamId !== undefined) {
    return explicitTeamId;
  }

  return findTeamIds(input)[0];
}

function findFirstNumber(input: unknown, keys: readonly string[]): number | undefined {
  return findNumbers(input, keys)[0];
}

function findNumbers(input: unknown, keys: readonly string[]): number[] {
  const values: number[] = [];
  const visited = new Set<object>();

  collectNumbers(input, new Set(keys), values, visited);

  return values;
}

function collectNumbers(
  input: unknown,
  keys: ReadonlySet<string>,
  values: number[],
  visited: Set<object>
): void {
  if (!isRecord(input) || visited.has(input)) {
    return;
  }

  visited.add(input);

  for (const [key, value] of Object.entries(input)) {
    if (keys.has(key) && typeof value === "number") {
      values.push(value);
    }
  }

  for (const value of Object.values(input)) {
    collectNumbers(value, keys, values, visited);
  }
}

function findTeamIds(input: unknown): number[] {
  const values: number[] = [];
  const visited = new Set<object>();

  collectTeamIds(input, values, visited);

  return values;
}

function collectTeamIds(input: unknown, values: number[], visited: Set<object>): void {
  if (!isRecord(input) || visited.has(input)) {
    return;
  }

  visited.add(input);

  for (const [key, value] of Object.entries(input)) {
    if ((key === "team" || key === "club") && isRecord(value)) {
      const teamId = value.id;
      if (typeof teamId === "number") {
        values.push(teamId);
      }
    }

    if ((key === "team" || key === "club") && typeof value === "number") {
      values.push(value);
    }

    collectTeamIds(value, values, visited);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
