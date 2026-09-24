import type {
  CurrentClubContextDto,
  JuniorDto,
  PlayerDto,
  PlayerFormation,
  PlayerTrainingWeekDto,
  SnapshotJuniorDto,
  SnapshotPlayerDto
} from "./types.js";
import { suggestDevelopmentProfile, type DevelopmentProfile, type SkillSet } from "@atlas/domain";

export function mapCurrentContextToSnapshotClub(current: CurrentClubContextDto): {
  clubId: number;
  country: number;
  name: string;
  gameWeek: number;
  training: null;
} {
  return {
    clubId: current.team.id,
    country: current.team.country.code,
    name: current.team.name,
    gameWeek: current.calendar.gameWeek,
    training: null
  };
}

export function mapPlayersToSnapshotPlayers(
  players: readonly PlayerDto[],
  training: readonly PlayerTrainingWeekDto[]
): SnapshotPlayerDto[] {
  const trainingByPlayerId = new Map(training.map((week) => [week.playerId, week]));

  return players.map((player) => {
    const latestTraining = trainingByPlayerId.get(player.id);
    const skills = {
      stamina: player.skills.stamina,
      pace: player.skills.pace,
      technique: player.skills.technique,
      passing: player.skills.passing,
      keeper: player.skills.keeper,
      defender: player.skills.defending,
      playmaker: player.skills.playmaking,
      striker: player.skills.striker
    };

    const historicalTrainedFormation = latestTraining?.formation ?? player.formation;

    return {
      playerId: player.id,
      name: player.name.fullName,
      age: player.age,
      wage: player.wage.value,
      value: player.value.value,
      training: {
        position: formationToPosition(historicalTrainedFormation, skills),
        advanced: latestTraining?.kind === "advanced"
      },
      form: player.skills.form,
      availabilityStatus: player.injury.daysRemaining > 0 ? "injured" : "available",
      observedPosition: null,
      skills,
      cards: player.cards,
      injury: {
        days: player.injury.daysRemaining,
        severe: player.injury.severe
      }
    };
  });
}

export function mapJuniorsToSnapshotJuniors(juniors: readonly JuniorDto[]): SnapshotJuniorDto[] {
  return juniors.map((junior) => ({
    playerId: junior.id,
    name: junior.name.fullName,
    age: junior.age,
    weeksRemaining: junior.weeksLeft,
    skill: junior.currentLevel,
    status: "in_academy"
  }));
}

export function formationForProfile(profile: DevelopmentProfile): PlayerFormation {
  switch (profile) {
    case "goalkeeper":
      return "GK";
    case "defender":
      return "DEF";
    case "midfielder":
      return "MID";
    case "forward":
      return "ATT";
  }
}

export function inferPlayerFormationFromSkills(skills: SkillSet): PlayerFormation {
  const profile = suggestDevelopmentProfile({ playerId: 0, skills }).profile;
  return formationForProfile(profile);
}

function formationToPosition(formation: PlayerFormation | null, skills: SkillSet): number {
  const effective = formation ?? inferPlayerFormationFromSkills(skills);
  switch (effective) {
    case "GK":
      return 0;
    case "DEF":
      return 1;
    case "MID":
      return 2;
    case "ATT":
      return 3;
  }
}

