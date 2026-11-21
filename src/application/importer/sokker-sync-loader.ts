import type { SokkerSyncPayload, TrainingSkillsResolver } from "./types.js";
import type { SokkerDataProvider } from "./providers/SokkerDataProvider.js";
import { inferPlayerFormationFromSkills } from "./snapshot-mappers.js";

export class SokkerSyncLoader {
  constructor(
    private readonly provider: SokkerDataProvider,
    private readonly resolveSkills?: TrainingSkillsResolver
  ) {}

  async load(): Promise<SokkerSyncPayload> {
    const current = await this.loadResource("current", () => this.provider.getCurrent());
    const trainingSummary = await this.loadResource("training summary", () =>
      this.provider.getTrainingSummary()
    );
    const requestedTrainingWeekId = trainingSummary.weeks
      .filter(
        (week) =>
          week.gameWeek <= current.calendar.gameWeek &&
          week.players.formationTraining + week.players.advancedTraining > 0
      )
      .sort((a, b) => b.gameWeek - a.gameWeek)[0]?.gameWeek;
    const knownSkills =
      requestedTrainingWeekId === undefined
        ? undefined
        : await this.resolveSkills?.(current.team.id, requestedTrainingWeekId);
    const [training, livePlayers, trainers, juniors, juniorMatchesRaw, arena] = await Promise.all([
      this.loadResource("training", () =>
        this.provider.getTraining(requestedTrainingWeekId, knownSkills)
      ),
      this.loadResource("live players", () => this.provider.getLivePlayers(current.team.id)),
      this.loadResource("trainer", () => this.provider.getTrainers()),
      this.loadResource("junior", () => this.provider.getJuniors()),
      this.loadResource("junior matches", () =>
        this.provider.getJuniorMatches(current.calendar.season)
      ),
      this.loadResource("arena", () => this.provider.getArena(current.team.id)).catch((err) => {
        console.warn(`Failed to fetch arena for team ${current.team.id}:`, err);
        return null;
      })
    ]);

    // Enrich juniors with formation from XML (0 = GK, 1 = field). Fails gracefully if XML is unavailable.
    let juniorsWithFormation = juniors;
    try {
      const xmlEntries = await this.provider.getJuniorsXml();
      console.log(`XML returned ${xmlEntries.length} juniors. Mapping formations...`);
      const formationById = new Map(xmlEntries.map((e) => [e.id, e.formation]));
      juniorsWithFormation = juniors.map((j) => {
        const formation = formationById.has(j.id) ? (formationById.get(j.id) ?? null) : j.formation;
        console.log(
          `Junior ${j.id}: formation from XML = ${formationById.get(j.id)}, final = ${formation}`
        );
        return { ...j, formation };
      });
    } catch (e) {
      console.error("Failed to fetch/parse juniors XML:", e);
      // XML not available — continue without formation data
    }

    const { parseJuniorMatchXml } = await import("./parsers/xml-match-parser.js");

    const juniorMatches = await Promise.all(
      juniorMatchesRaw
        .filter((m) => m.isFinished)
        .map(async (m) => {
          try {
            const xml = await this.provider.getMatchXml(m.matchId);
            const lineup = await this.provider.getMatchLineup(m.matchId);
            const playerStats = parseJuniorMatchXml(xml, lineup);
            return { ...m, playerStats };
          } catch {
            return { ...m, playerStats: [] };
          }
        })
    );

    const liveTrainingByPlayerId = new Map(
      livePlayers.map((player) => [player.id, player] as const)
    );
    const livePlayerIds = new Set(livePlayers.map((player) => player.id));
    const currentTeamId = current.team.id;
    const trainingPlayerIds = new Set(training.players.map((player) => player.id));
    const livePlayersWithoutTraining = livePlayers.filter(
      (player) => !trainingPlayerIds.has(player.id)
    );
    const hydratedLivePlayers = await Promise.all(
      livePlayersWithoutTraining.map((player) =>
        this.loadResource(`player ${player.id}`, () => this.provider.getPlayer(player.id))
      )
    );
    const rosterCandidates = [...training.players, ...hydratedLivePlayers];
    const currentTrainingPlayerIds = new Set(
      rosterCandidates
        .filter((player) => player.teamId === currentTeamId && livePlayerIds.has(player.id))
        .map((player) => player.id)
    );
    const excludedTrainingPlayerIds = [
      ...new Set(
        training.trainingWeeks
          .filter((report) => !currentTrainingPlayerIds.has(report.playerId))
          .map((report) => report.playerId)
      )
    ];
    const playersWithLiveFormation = rosterCandidates
      .filter((player) => currentTrainingPlayerIds.has(player.id))
      .map((player) => {
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
        const liveTraining = liveTrainingByPlayerId.get(player.id);
        const liveFormation =
          liveTraining?.formation ?? player.formation ?? inferPlayerFormationFromSkills(skills);
        return {
          ...player,
          formation: liveFormation,
          advancedTraining: liveTraining?.advanced
        };
      });
    // Historical reports belong to the requested week, including players who have since left.
    const trainingWeeks = training.trainingWeeks;
    const playersWithoutTrainingReportIds = playersWithLiveFormation
      .filter((player) => !trainingPlayerIds.has(player.id))
      .map((player) => player.id);

    return {
      current,
      players: playersWithLiveFormation,
      trainingWeeks,
      requestedTrainingWeekId,
      trainingReportDiagnostics: training.reportDiagnostics,
      excludedTrainingPlayerIds,
      playersWithoutTrainingReportIds,
      trainers,
      juniors: juniorsWithFormation,
      trainingSummary,
      juniorMatches,
      arena
    };
  }

  private async loadResource<T>(resource: string, loader: () => Promise<T>): Promise<T> {
    try {
      return await loader();
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      const punctuation = detail.endsWith(".") ? "" : ".";

      throw new Error(`Failed to fetch Sokker ${resource} data: ${detail}${punctuation}`, {
        cause
      });
    }
  }
}

export async function loadSokkerSyncPayload(
  provider: SokkerDataProvider,
  resolveSkills?: TrainingSkillsResolver
): Promise<SokkerSyncPayload> {
  return new SokkerSyncLoader(provider, resolveSkills).load();
}
