import type { OperationalArea } from "../../types";

export interface ModuleGridProps {
  areas: OperationalArea[];
  onOpenSquadEconomy?: () => void;
  onOpenPlayerDevelopment?: () => void;
  onOpenSquadMarketPlanning?: () => void;
  onOpenYouthPipelinePlanning?: () => void;
}