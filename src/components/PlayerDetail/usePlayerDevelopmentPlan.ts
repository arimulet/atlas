import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlayerDevelopmentTargetOverride } from "@atlas/domain";
import {
  resetPlayerDevelopmentTarget,
  savePlayerDevelopmentTarget
} from "@/api";
import type { TrainingPageData } from "@/app/types";
import type { PlayerDetailViewModel } from "@/app/view-models/player-detail-view-model";
import {
  createDevelopmentPlanViewModel,
  type DevelopmentPlanViewModel
} from "./development-plan-view-model";

export interface UsePlayerDevelopmentPlanInput {
  clubId: string | null;
  player: PlayerDetailViewModel;
  training: TrainingPageData | null;
  onTargetUpdated?: () => Promise<void> | void;
}

export interface PlayerDevelopmentPlanState {
  plan: DevelopmentPlanViewModel | null;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  updateTarget: (override: PlayerDevelopmentTargetOverride) => Promise<void>;
  resetToAutomatic: () => Promise<void>;
}

export function usePlayerDevelopmentPlan(
  input: UsePlayerDevelopmentPlanInput
): PlayerDevelopmentPlanState {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const plan = useMemo(
    () =>
      createDevelopmentPlanViewModel({
        player: input.player,
        training: input.training
      }),
    [input.player, input.training]
  );

  const updateTarget = useCallback(
    async (override: PlayerDevelopmentTargetOverride): Promise<void> => {
      if (!input.clubId) return;

      setIsSaving(true);
      setError(null);
      try {
        await savePlayerDevelopmentTarget(
          input.clubId,
          input.player.player.id,
          override
        );
        if (input.onTargetUpdated) {
          await input.onTargetUpdated();
        }
        router.refresh();
      } catch (caught: unknown) {
        const nextError =
          caught instanceof Error ? caught : new Error("Development target unavailable.");
        setError(nextError);
        throw nextError;
      } finally {
        setIsSaving(false);
      }
    },
    [input.clubId, input.player.player.id, input.onTargetUpdated, router]
  );

  const resetToAutomatic = useCallback(async (): Promise<void> => {
    if (!input.clubId) return;

    setIsSaving(true);
    setError(null);
    try {
      await resetPlayerDevelopmentTarget(input.clubId, input.player.player.id);
      if (input.onTargetUpdated) {
        await input.onTargetUpdated();
      }
      router.refresh();
    } catch (caught: unknown) {
      const nextError =
        caught instanceof Error ? caught : new Error("Development target unavailable.");
      setError(nextError);
      throw nextError;
    } finally {
      setIsSaving(false);
    }
  }, [input.clubId, input.player.player.id, input.onTargetUpdated, router]);

  return { plan, isLoading: false, isSaving, error, updateTarget, resetToAutomatic };
}
