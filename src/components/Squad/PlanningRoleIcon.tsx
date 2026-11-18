import { ArrowRightLeft, Crown, Layers, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import type { SquadRole } from "@atlas/domain";

const ROLE_STYLES = {
  core: { icon: Crown, color: "#f59e0b" },
  rotation: { icon: RefreshCw, color: "#38bdf8" },
  depth: { icon: Layers, color: "#94a3b8" },
  prospect: { icon: Sparkles, color: "#a855f7" },
  developing: { icon: TrendingUp, color: "#22c55e" },
  transition: { icon: ArrowRightLeft, color: "#f97316" }
} satisfies Record<SquadRole, { icon: typeof Crown; color: string }>;

export function PlanningRoleIcon({ role }: { role: SquadRole }) {
  const { icon: Icon, color } = ROLE_STYLES[role];
  return <Icon size={role === "core" ? 12 : 11} style={{ color }} aria-hidden="true" />;
}
