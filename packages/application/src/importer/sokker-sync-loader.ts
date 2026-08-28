import type { SokkerSyncPayload } from "./types.js";
import type { SokkerDataProvider } from "./providers/SokkerDataProvider.js";

export class SokkerSyncLoader {
  constructor(private readonly provider: SokkerDataProvider) {}

  async load(): Promise<SokkerSyncPayload> {
    const current = await this.loadResource("current", () => this.provider.getCurrent());
    const [training, trainers, juniors, trainingSummary, juniorMatchesRaw] = await Promise.all([
      this.loadResource("training", () => this.provider.getTraining()),
      this.loadResource("trainer", () => this.provider.getTrainers()),
      this.loadResource("junior", () => this.provider.getJuniors()),
      this.loadResource("training summary", () => this.provider.getTrainingSummary()),
      this.loadResource("junior matches", () => this.provider.getJuniorMatches(current.calendar.season))
    ]);

    const { parseJuniorMatchXml } = await import("./parsers/xml-match-parser.js");

    const juniorMatches = await Promise.all(
      juniorMatchesRaw.filter(m => m.isFinished).map(async (m) => {
        try {
          const xml = await this.provider.getMatchXml(m.matchId);
          const lineup = await this.provider.getMatchLineup(m.matchId);
          const playerStats = parseJuniorMatchXml(xml, lineup);
          return { ...m, playerStats };
        } catch (e) {
          return { ...m, playerStats: [] };
        }
      })
    );

    return {
      current,
      players: training.players,
      trainingWeeks: training.trainingWeeks,
      trainers,
      juniors,
      trainingSummary,
      juniorMatches
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
  provider: SokkerDataProvider
): Promise<SokkerSyncPayload> {
  return new SokkerSyncLoader(provider).load();
}
