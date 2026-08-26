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

    return {
      playerId: player.id,
      name: player.name.fullName,
      age: player.age,
      wage: player.wage.value,
      value: player.value.value,
      training: {
        position: formationToPosition(player.formation, skills),
        advanced: latestTraining?.kind === "advanced"
      },
      form: player.skills.form,
      availabilityStatus: player.injury.daysRemaining > 0 ? "injured" : "available",
      observedPosition: null,
      skills
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

function formationToPosition(formation: PlayerFormation | null, skills: SkillSet): number {
  switch (formation) {
    case "GK":
      return 0;
    case "DEF":
      return 1;
    case "MID":
      return 2;
    case "ATT":
      return 3;
    case null:
      return positionForProfile(suggestDevelopmentProfile({ playerId: 0, skills }).profile);
  }
}

function positionForProfile(profile: DevelopmentProfile): number {
  if (profile === "goalkeeper") return 0;
  if (profile === "defender" || profile === "wing_defender") return 1;
  if (profile === "midfielder" || profile === "winger") return 2;
  return 3;
}
