import type { SokkerSyncPayload } from "./types.js";
import type { SokkerDataProvider } from "./providers/SokkerDataProvider.js";

export class SokkerSyncLoader {
  constructor(private readonly provider: SokkerDataProvider) {}

  async load(): Promise<SokkerSyncPayload> {
    const current = await this.loadResource("current", () => this.provider.getCurrent());
    const [training, trainers, juniors, trainingSummary] = await Promise.all([
      this.loadResource("training", () => this.provider.getTraining()),
      this.loadResource("trainer", () => this.provider.getTrainers()),
      this.loadResource("junior", () => this.provider.getJuniors()),
      this.loadResource("training summary", () => this.provider.getTrainingSummary())
    ]);

    return {
      current,
      players: training.players,
      trainingWeeks: training.trainingWeeks,
      trainers,
      juniors,
      trainingSummary
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
