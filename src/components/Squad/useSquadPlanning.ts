import { useMemo, useState } from "react";

import type { DevelopmentProfile } from "@atlas/domain";
import type { SquadPlanningBundle } from "@atlas/web/app/types";
import type { SquadPlayerRow } from "../../view-models/squad-view-model";
import {
  createSquadPlanningViewModel,
  filterSquadRows,
  type SquadPlanningFilters,
  type SquadPlanningViewModel,
  type SquadRoleFilter
} from "./squad-planning-view-model";

interface UseSquadPlanningInput {
  planning: SquadPlanningBundle | null;
  rows: readonly SquadPlayerRow[];
}

interface UseSquadPlanningResult {
  viewModel: SquadPlanningViewModel | null;
  filters: SquadPlanningFilters;
  filteredRows: SquadPlayerRow[];
  setRoleFilter: (role: SquadRoleFilter) => void;
  setProfileFilter: (profile: DevelopmentProfile | "all") => void;
}

export function useSquadPlanning({
  planning,
  rows
}: UseSquadPlanningInput): UseSquadPlanningResult {
  const [filters, setFilters] = useState<SquadPlanningFilters>({ role: "all", profile: "all" });
  const viewModel = useMemo(
    () => (planning ? createSquadPlanningViewModel(planning, rows) : null),
    [planning, rows]
  );
  const filteredRows = useMemo(
    () => filterSquadRows(rows, planning, filters, viewModel?.attentionPlayerIds ?? new Set()),
    [filters, planning, rows, viewModel]
  );

  return {
    viewModel,
    filters,
    filteredRows,
    setRoleFilter: (role: SquadRoleFilter) => setFilters((current) => ({ ...current, role })),
    setProfileFilter: (profile: DevelopmentProfile | "all") =>
      setFilters((current) => ({ ...current, profile }))
  };
}
