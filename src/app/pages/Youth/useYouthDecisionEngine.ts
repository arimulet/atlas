import { useEffect, useMemo, useState } from "react";

import { fetchYouthDecisionPlanning } from "../../api";
import type { RealYouthAcademyPlanning } from "../../types";
import type {
  YouthDecisionRecommendation,
  YouthDevelopmentOpportunity,
  YouthProspectAssessment
} from "@atlas/domain";
import {
  createYouthDecisionViewModels,
  type YouthDecisionViewModel
} from "./youth-decision-view-model";
import type { YouthDecisionPlanning } from "@atlas/application";

export interface UseYouthDecisionEngineInput {
  clubId: string | null;
  currency: string | null;
  youthAcademy: RealYouthAcademyPlanning | null;
}

export interface YouthDecisionEngineState {
  youthSchool: RealYouthAcademyPlanning["derived"]["players"];
  decisionCandidates: YouthDecisionViewModel[];
  assessments: YouthProspectAssessment[];
  opportunities: YouthDevelopmentOpportunity[];
  recommendations: YouthDecisionRecommendation[];
  isLoading: boolean;
  error: Error | null;
  status: "idle" | "loading" | "ready" | "error";
}

export function useYouthDecisionEngine({
  clubId,
  currency,
  youthAcademy
}: UseYouthDecisionEngineInput): YouthDecisionEngineState {
  const [planning, setPlanning] = useState<YouthDecisionPlanning | null>(null);
  const [status, setStatus] = useState<YouthDecisionEngineState["status"]>(
    clubId ? "loading" : "idle"
  );
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isCurrent = true;

    if (!clubId) {
      setPlanning(null);
      setError(null);
      setStatus("idle");
      return () => {
        isCurrent = false;
      };
    }

    setStatus("loading");
    setError(null);
    void fetchYouthDecisionPlanning(clubId)
      .then((nextPlanning) => {
        if (!isCurrent) return;
        setPlanning(nextPlanning);
        setStatus("ready");
      })
      .catch((nextError: unknown) => {
        if (!isCurrent) return;
        setPlanning(null);
        setStatus("error");
        setError(
          nextError instanceof Error ? nextError : new Error("Decision engine unavailable.")
        );
      });

    return () => {
      isCurrent = false;
    };
  }, [clubId, youthAcademy?.snapshotId]);

  const decisionCandidates = useMemo(
    () => createYouthDecisionViewModels(planning, currency),
    [currency, planning]
  );
  const candidates = planning?.candidates ?? [];

  return {
    youthSchool:
      youthAcademy?.derived.players.filter((player) => player.status !== "promoted") ?? [],
    decisionCandidates,
    assessments: candidates.map((candidate) => candidate.prospect),
    opportunities: candidates.map((candidate) => candidate.opportunity),
    recommendations: candidates.map((candidate) => candidate.recommendation),
    isLoading: status === "loading",
    error,
    status
  };
}
