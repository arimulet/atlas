import type { OperationalArea } from "@atlas/web/app/types";

export interface ModuleGridProps {
  areas: OperationalArea[];
  onOpenSquadEconomy?: () => void;
  onOpenPlayerDevelopment?: () => void;
  onOpenSquadMarketPlanning?: () => void;
  onOpenYouthPipelinePlanning?: () => void;
}