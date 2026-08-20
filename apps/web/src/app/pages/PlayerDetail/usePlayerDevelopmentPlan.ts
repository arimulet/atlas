import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlayerDevelopmentTargetOverride } from "@atlas/domain";
import {
  fetchPlayerDevelopmentTarget,
  resetPlayerDevelopmentTarget,
  savePlayerDevelopmentTarget,
  type PlayerDevelopmentTargetOverrideResponse
} from "../../api";
import type { TrainingPageData } from "../../types";
import type { PlayerDetailViewModel } from "../../view-models/player-detail-view-model";
import {
  createDevelopmentPlanViewModel,
  type DevelopmentPlanViewModel
} from "./development-plan-view-model";

export interface UsePlayerDevelopmentPlanInput {
  clubId: string | null;
  player: PlayerDetailViewModel;
  training: TrainingPageData | null;
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
  const [manualOverride, setManualOverride] = useState<PlayerDevelopmentTargetOverride | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(input.clubId !== null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isCurrent = true;

    if (!input.clubId) {
      setManualOverride(null);
      setIsLoading(false);
      setError(null);
      return () => {
        isCurrent = false;
      };
    }

    setIsLoading(true);
    setError(null);
    void fetchPlayerDevelopmentTarget(input.clubId, input.player.player.id)
      .then((response) => {
        if (!isCurrent) return;
        setManualOverride(response ? toDomainOverride(response) : null);
        setIsLoading(false);
      })
      .catch((caught: unknown) => {
        if (!isCurrent) return;
        setError(caught instanceof Error ? caught : new Error("Development target unavailable."));
        setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [input.clubId, input.player.player.id]);

  const plan = useMemo(
    () =>
      createDevelopmentPlanViewModel({
        player: input.player,
        training: input.training,
        manualOverride
      }),
    [input.player, input.training, manualOverride]
  );

  const updateTarget = useCallback(
    async (override: PlayerDevelopmentTargetOverride): Promise<void> => {
      if (!input.clubId) return;

      setIsSaving(true);
      setError(null);
      try {
        const response = await savePlayerDevelopmentTarget(
          input.clubId,
          input.player.player.id,
          override
        );
        setManualOverride(toDomainOverride(response));
      } catch (caught: unknown) {
        const nextError =
          caught instanceof Error ? caught : new Error("Development target unavailable.");
        setError(nextError);
        throw nextError;
      } finally {
        setIsSaving(false);
      }
    },
    [input.clubId, input.player.player.id]
  );

  const resetToAutomatic = useCallback(async (): Promise<void> => {
    if (!input.clubId) return;

    setIsSaving(true);
    setError(null);
    try {
      await resetPlayerDevelopmentTarget(input.clubId, input.player.player.id);
      setManualOverride(null);
    } catch (caught: unknown) {
      const nextError =
        caught instanceof Error ? caught : new Error("Development target unavailable.");
      setError(nextError);
      throw nextError;
    } finally {
      setIsSaving(false);
    }
  }, [input.clubId, input.player.player.id]);

  return { plan, isLoading, isSaving, error, updateTarget, resetToAutomatic };
}

function toDomainOverride(
  response: PlayerDevelopmentTargetOverrideResponse
): PlayerDevelopmentTargetOverride {
  return {
    profile: response.profile,
    targetLevels: response.targetLevels,
    targetAge: response.targetAge
  };
}
