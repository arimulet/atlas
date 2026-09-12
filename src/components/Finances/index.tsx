import type { ReactNode } from "react";
import {
  ArrowRight,
  Award,
  Coins,
  Crown,
  Droplets,
  Info,
  Layers,
  Lock,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
  ArrowRightLeft
} from "lucide-react";
import { formatMoney } from "@/app/formatters";
import { PlayerLink } from "@/components/PlayerLink";
import { PositionBadge } from "@/components/PositionBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { registerPlayerCountries } from "@/context/PlayerCountryContext";
import type { FinancesProps } from "./types";
import type { FinancialStrategyState } from "@/app/features/financialStrategy/useFinancialStrategy";

export function Finances({
  dashboard,
  onSelectPlayer,
  squadPlanning,
  status,
  financialStrategy
}: FinancesProps) {
  if (squadPlanning?.assessment?.depthPlayers) {
    registerPlayerCountries(squadPlanning.assessment.depthPlayers);
  }
  return (
    <div className="atlas-finances">
      <header className="atlas-finances__header">
        <h1>Finances</h1>
      </header>
      {financialStrategy.status === "loading" ? (
        <PanelMessage>Loading financial strategy...</PanelMessage>
      ) : null}
      {financialStrategy.status === "error" ? (
        <PanelMessage tone="error">
          Financial Strategy is temporarily unavailable. Basic cash data remains available.
        </PanelMessage>
      ) : null}
      <FinancialPositionSection
        dashboard={dashboard}
        financialStrategy={financialStrategy}
        status={status}
      />
      <CapitalCapacitySection financialStrategy={financialStrategy} />
      <StrategicRecommendationsSection
        financialStrategy={financialStrategy}
        onSelectPlayer={onSelectPlayer}
      />
      <FundingPlanSection financialStrategy={financialStrategy} />
      <SquadAssetsSection financialStrategy={financialStrategy} onSelectPlayer={onSelectPlayer} />

      <ConflictsSection financialStrategy={financialStrategy} onSelectPlayer={onSelectPlayer} />
      {squadPlanning === null && status === "ready" ? (
        <PanelMessage>
          Squad Planning is not available. Financial position and cash capacity remain visible.
        </PanelMessage>
      ) : null}
    </div>
  );
}

function FinancialPositionSection({
  dashboard,
  financialStrategy,
  status
}: {
  dashboard: FinancesProps["dashboard"];
  financialStrategy: FinancialStrategyState;
  status: FinancesProps["status"];
}) {
  const position = financialStrategy.viewModel?.position;
  const fallbackCash = dashboard?.club?.budget ?? null;
  return (
    <Section title="Financial Position" className="atlas-finances-position">
      {position ? (
        <>
          <div className="atlas-finances-status-row">
            <StatusBadge status={position.statusLabel} />
            <span>{position.confidence} confidence</span>
          </div>
          <MetricGrid
            metrics={[
              ["Cash", position.cash, position.provenance.cash],
              [
                "Squad Asset Value",
                position.squadValue,
                `${position.provenance.squadValue} · ${position.squadValueCoverage}`
              ],
              ["Known Weekly Payroll", position.payroll, "Derived from known wages"],
              ["Known Payroll Coverage", position.payrollCoverage, "Derived safety metric"],
              ["Known Capital", position.knownCapital, "Observed cash + estimated sporting assets"],
              ["Liquidity", position.liquidity, "Cash share of known capital"]
            ]}
          />
          <PositionSignals reasons={position.reasons} warnings={position.warnings} />
        </>
      ) : (
        <PanelMessage>
          {status === "loading"
            ? "Loading financial position..."
            : fallbackCash !== null
              ? `Cash · ${formatMoney({ amount: fallbackCash, currency: dashboard?.club?.currency ?? null, isComplete: true })} · Observed`
              : "Financial position data is not available yet."}
        </PanelMessage>
      )}
    </Section>
  );
}

function CapitalCapacitySection({
  financialStrategy
}: {
  financialStrategy: FinancialStrategyState;
}) {
  const capacity = financialStrategy.viewModel?.capacity;
  return (
    <Section title="Capital Capacity">
      {capacity ? (
        <>
          <MetricGrid
            metrics={[
              ["Cash", financialStrategy.viewModel?.position.cash ?? "—", "Observed"],
              ["Safety Reserve", capacity.reserve, `${capacity.reserveWeeks} · ATLAS policy`],
              ["Spendable Cash", capacity.spendableCash, "Cash after protected reserve"],
              ["Conservative Capacity", capacity.conservative, "Prudent commitment"],
              ["Maximum Recommended", capacity.maximumRecommended, "Upper recommended commitment"]
            ]}
          />
          <p className="atlas-finances-panel__note">
            Safety reserve is a strategic ATLAS policy, not a game obligation.
          </p>
        </>
      ) : (
        <PanelMessage>Capital capacity is not available yet.</PanelMessage>
      )}
    </Section>
  );
}

function StrategicRecommendationsSection({
  financialStrategy,
  onSelectPlayer
}: {
  financialStrategy: FinancialStrategyState;
  onSelectPlayer: (playerId: string) => void;
}) {
  const recommendations = financialStrategy.viewModel?.recommendations ?? [];
  return (
    <Section title="Strategic Recommendations" className="atlas-finances-recommendations">
      {financialStrategy.status === "ready" && recommendations.length === 0 ? (
        <PanelMessage>
          Financial strategy is currently stable. No high-priority action required.
        </PanelMessage>
      ) : null}
      <div className="atlas-finances-recommendation-list">
        {recommendations.map((recommendation) => (
          <article
            className={`atlas-finances-recommendation is-${recommendation.priority.toLowerCase()}`}
            key={recommendation.id}
          >
            <div className="atlas-finances-recommendation__header">
              <div>
                <span className="atlas-finances-eyebrow">
                  {recommendation.priority} · {recommendation.horizon}
                </span>
                <h3>{recommendation.title}</h3>
              </div>
              <StatusBadge status={recommendation.confidence} />
            </div>
            <p>{recommendation.description}</p>
            {recommendation.playerIds.length > 0 ? (
              <div className="atlas-finances-player-links">
                {recommendation.playerIds.map((playerId, index) => (
                  <PlayerLink
                    key={playerId}
                    playerId={String(playerId)}
                    onSelectPlayer={onSelectPlayer}
                  >
                    {recommendation.playerNames[index] ?? `Player ${playerId}`}
                  </PlayerLink>
                ))}
              </div>
            ) : null}
            <ul className="atlas-finances-reason-list">
              {recommendation.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {recommendation.financialImpact.length > 0 ? (
              <div className="atlas-finances-impact">
                {recommendation.financialImpact.join(" · ")}
              </div>
            ) : null}
            {recommendation.risks.length > 0 ? (
              <details className="atlas-finances-recommendation__details">
                <summary>Risks</summary>
                <ul className="atlas-finances-risk-list">
                  {recommendation.risks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </article>
        ))}
      </div>
    </Section>
  );
}

function FundingPlanSection({ financialStrategy }: { financialStrategy: FinancialStrategyState }) {
  const funding = financialStrategy.viewModel?.funding;
  return (
    <Section title="Strategic Funding">
      {!funding || funding.needs.length === 0 ? (
        <PanelMessage>
          {financialStrategy.status === "ready"
            ? "Strategic funding needs are not available from current Squad Planning data."
            : "Funding plan is not available yet."}
        </PanelMessage>
      ) : (
        <>
          <div className="atlas-finances-table-wrap">
            <table className="atlas-finances-table">
              <thead>
                <tr>
                  <th>Need</th>
                  <th>Priority</th>
                  <th>Horizon</th>
                  <th>Expected</th>
                  <th>Allocated</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {funding.needs.map((need) => (
                  <tr key={need.id}>
                    <th scope="row">{need.profile}</th>
                    <td>{need.priority}</td>
                    <td>{need.horizon}</td>
                    <td>{need.expectedCost}</td>
                    <td>{need.allocated}</td>
                    <td>{need.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {funding.totalGap !== "—" ? (
            <p className="atlas-finances-gap">Total estimated funding gap: {funding.totalGap}</p>
          ) : null}
        </>
      )}
    </Section>
  );
}

function SquadAssetsSection({
  financialStrategy,
  onSelectPlayer
}: {
  financialStrategy: FinancialStrategyState;
  onSelectPlayer: (playerId: string) => void;
}) {
  const assets = financialStrategy.viewModel?.assets;
  const development = financialStrategy.viewModel?.developmentCapital;
  if (!assets)
    return (
      <Section title="Squad Assets">
        <PanelMessage>Squad asset valuation is not available yet.</PanelMessage>
      </Section>
    );
  return (
    <Section title="Squad Assets">
      <MetricGrid
        metrics={[
          ["Estimated Squad Value", assets.estimatedValue, `Estimated · ${assets.coverage}`],
          ["Current Cash", financialStrategy.viewModel?.position.cash ?? "—", "Observed"],
          ["Known Capital", assets.knownCapital, "Observed cash + estimated sporting assets"],
          [
            "Top 3 Concentration",
            assets.concentration,
            assets.concentrationWarning ? "High asset concentration" : "Derived market metric"
          ],
          ["Potential Liquidity", assets.potentialLiquidity, "Not cash until a transfer occurs"]
        ]}
      />
      <DevelopmentUpside development={development} />
      {assets.distribution.length > 0 ? (
        <CompactList
          title="Asset distribution"
          items={assets.distribution.map((item) => `${item.role} · ${item.value}`)}
        />
      ) : null}
      {assets.monetizable.length > 0 || assets.protectedAssets.length > 0 ? (
        <div className="atlas-finances-asset-grid">
          {assets.monetizable.length > 0 ? (
            <AssetList
              title="Potential Liquidity"
              assets={assets.monetizable}
              onSelectPlayer={onSelectPlayer}
            />
          ) : null}
          {assets.protectedAssets.length > 0 ? (
            <ProtectedAssetList
              assets={assets.protectedAssets}
              onSelectPlayer={onSelectPlayer}
            />
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}

interface DevelopmentUpsideProps {
  development: NonNullable<FinancialStrategyState["viewModel"]>["developmentCapital"] | undefined;
}

function DevelopmentUpside({ development }: DevelopmentUpsideProps) {
  if (!development) return null;

  return (
    <aside className="atlas-finances-development-upside" aria-label="Development upside">
      <div>
        <span>Development upside</span>
        <small>
          {development.coveredPlayers} · {development.confidence} confidence
        </small>
      </div>
      <strong>{development.valueCreation}</strong>
      <p>
        Projected covered value: {development.currentValue} <ArrowRight size={13} className="inline-block align-middle" /> {development.projectedValue}
      </p>
    </aside>
  );
}

function getRoleTooltip(role: string, rawRole?: string): string {
  const normalized = (rawRole ?? role).toLowerCase();
  if (normalized.includes("core")) {
    return `Squad Role: Core · Key starter essential to the team's competitive structure.`;
  }
  if (normalized.includes("rotation")) {
    return `Squad Role: Rotation · Regularly alternates starts and important match minutes.`;
  }
  if (normalized.includes("depth")) {
    return `Squad Role: Depth · Squad backup option for tactical rotation and schedule demands.`;
  }
  if (normalized.includes("prospect")) {
    return `Squad Role: Prospect · Young talent with high sporting ceiling and resale value.`;
  }
  if (normalized.includes("develop")) {
    return `Squad Role: Developing · In active technical progression and market value growth phase.`;
  }
  if (normalized.includes("transition")) {
    return `Squad Role: Transition · In squad role redefinition or concluding cycle phase.`;
  }
  return `Squad Role: ${role}`;
}

function getLiquidityTooltip(liquidity: string, rawLiquidity?: string): string {
  const mod = (rawLiquidity ?? liquidity).toLowerCase();
  if (mod.includes("high")) {
    return `Liquidity Potential: High · Strong market demand; easily monetized without discount.`;
  }
  if (mod.includes("medium")) {
    return `Liquidity Potential: Medium · Moderate market demand; requires active negotiation to monetize.`;
  }
  if (mod.includes("low")) {
    return `Liquidity Potential: Low · Restricted or niche market; slower sale or subject to price reductions.`;
  }
  return `Liquidity Potential: ${liquidity}`;
}

function getProtectedReasonTooltip(reason: string, rawReason?: string): string {
  const key = (rawReason ?? reason).toLowerCase();
  if (key.includes("core")) {
    return "Protection Reason: Core asset · Critical starter essential to the team's competitive structure.";
  }
  if (key.includes("successor")) {
    return "Protection Reason: No ready successor · No viable replacement currently prepared in the squad.";
  }
  if (key.includes("future") || key.includes("contribution")) {
    return "Protection Reason: High future contribution · Projected high sporting and financial value upside.";
  }
  if (key.includes("need") || key.includes("profile")) {
    return "Protection Reason: Strong profile need · Scarce tactical role in the squad that is costly to replace externally.";
  }
  if (key.includes("market") || key.includes("value")) {
    return "Protection Reason: High market value · Elite asset retained to preserve the club's financial capital.";
  }
  if (key.includes("coverage") || key.includes("covered")) {
    return "Protection Reason: Successor coverage exists · Positional depth and succession are covered.";
  }
  if (key.includes("development") || key.includes("upside")) {
    return "Protection Reason: Limited development upside · Player is near or at established peak performance.";
  }
  return `Protection Reason: ${reason}`;
}

function AssetRoleIcon({ role, rawRole }: { role: string; rawRole?: string }) {
  const tooltip = getRoleTooltip(role, rawRole);
  const normalized = (rawRole ?? role).toLowerCase();
  let icon = <Crown size={12} />;
  let modifier = "core";
  if (normalized.includes("rotation")) {
    icon = <RefreshCw size={11} />;
    modifier = "rotation";
  } else if (normalized.includes("depth")) {
    icon = <Layers size={11} />;
    modifier = "depth";
  } else if (normalized.includes("prospect")) {
    icon = <Sparkles size={11} />;
    modifier = "prospect";
  } else if (normalized.includes("develop")) {
    icon = <TrendingUp size={11} />;
    modifier = "developing";
  } else if (normalized.includes("transition")) {
    icon = <ArrowRightLeft size={11} />;
    modifier = "transition";
  }
  return (
    <span
      className={`atlas-asset-icon atlas-asset-icon--${modifier}`}
      data-tooltip={tooltip}
      aria-label={tooltip}
      role="img"
    >
      {icon}
    </span>
  );
}

function AssetLiquidityIcon({ liquidity, rawLiquidity }: { liquidity: string; rawLiquidity?: string }) {
  const tooltip = getLiquidityTooltip(liquidity, rawLiquidity);
  const mod = (rawLiquidity ?? liquidity).toLowerCase();
  return (
    <span
      className={`atlas-asset-icon atlas-asset-icon--liquidity-${mod}`}
      data-tooltip={tooltip}
      aria-label={tooltip}
      role="img"
    >
      <Droplets size={12} />
    </span>
  );
}

function AssetRecommendedIcon() {
  const tooltip =
    "Recommended Monetization · Strategic sale suggested to release liquidity for priority targets.";
  return (
    <span
      className="atlas-asset-icon atlas-asset-icon--recommended"
      data-tooltip={tooltip}
      aria-label={tooltip}
      role="img"
    >
      <Coins size={12} />
    </span>
  );
}

function ProtectedReasonIcon({ reason, rawReason }: { reason: string; rawReason?: string }) {
  const tooltip = getProtectedReasonTooltip(reason, rawReason);
  const lower = (rawReason ?? reason).toLowerCase();
  let icon = <Info size={11} />;
  let modifier = "info";
  if (lower.includes("core")) {
    icon = <Crown size={11} />;
    modifier = "core";
  } else if (lower.includes("successor")) {
    icon = <Lock size={11} />;
    modifier = "lock";
  } else if (lower.includes("future") || lower.includes("contribution")) {
    icon = <TrendingUp size={11} />;
    modifier = "future";
  } else if (lower.includes("profile") || lower.includes("need")) {
    icon = <Layers size={11} />;
    modifier = "need";
  } else if (lower.includes("market") || lower.includes("value")) {
    icon = <Award size={11} />;
    modifier = "value";
  }
  return (
    <span
      className={`atlas-asset-icon atlas-asset-icon--${modifier}`}
      data-tooltip={tooltip}
      aria-label={tooltip}
      role="img"
    >
      {icon}
    </span>
  );
}

function AssetList({
  title,
  assets,
  onSelectPlayer
}: {
  title: string;
  assets: NonNullable<FinancialStrategyState["viewModel"]>["assets"]["monetizable"];
  onSelectPlayer: (playerId: string) => void;
}) {
  const theoreticalTooltip =
    "Theoretical valuation · Calculated based on skills, age, and position due to lack of recent market references.";

  return (
    <div className="atlas-finances-subsection">
      <h3>{title}</h3>
      <ul className="atlas-finances-asset-list">
        {assets.map((asset) => (
          <li key={asset.playerId} className="atlas-finances-asset-row">
            <div className="atlas-finances-asset-row__player">
              {asset.position ? (
                <PositionBadge position={asset.position} size="sm" title="" />
              ) : null}
              <PlayerLink
                countryName={asset.countryName}
                playerId={String(asset.playerId)}
                onSelectPlayer={onSelectPlayer}
              >
                {asset.name}
              </PlayerLink>
              <div className="atlas-finances-asset-row__icons">
                <AssetRoleIcon role={asset.role} rawRole={asset.rawRole} />
                <AssetLiquidityIcon liquidity={asset.liquidity} rawLiquidity={asset.rawLiquidity} />
                {asset.recommended ? <AssetRecommendedIcon /> : null}
              </div>
            </div>
            <div className="atlas-finances-asset-row__value">
              <strong>{asset.value}</strong>
              {asset.isTheoretical ? (
                <span
                  data-tooltip={theoreticalTooltip}
                  aria-label={theoreticalTooltip}
                  className="atlas-finances-theoretical-icon"
                  role="img"
                >
                  <Info size={14} />
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProtectedAssetList({
  assets,
  onSelectPlayer
}: {
  assets: NonNullable<FinancialStrategyState["viewModel"]>["assets"]["protectedAssets"];
  onSelectPlayer: (playerId: string) => void;
}) {
  const protectedTooltip =
    "Protected Strategic Asset · Non-transferable; priority retention to sustain squad competitiveness.";
  const theoreticalTooltip =
    "Theoretical valuation · Calculated based on skills, age, and position due to lack of recent market references.";

  return (
    <div className="atlas-finances-subsection">
      <h3>Protected Strategic Assets</h3>
      <ul className="atlas-finances-asset-list">
        {assets.map((asset) => (
          <li key={asset.playerId} className="atlas-finances-asset-row">
            <div className="atlas-finances-asset-row__player">
              {asset.position ? (
                <PositionBadge position={asset.position} size="sm" title="" />
              ) : null}
              <PlayerLink
                countryName={asset.countryName}
                playerId={String(asset.playerId)}
                onSelectPlayer={onSelectPlayer}
              >
                {asset.name}
              </PlayerLink>
              <div className="atlas-finances-asset-row__icons">
                <span
                  className="atlas-asset-icon atlas-asset-icon--protected"
                  data-tooltip={protectedTooltip}
                  aria-label={protectedTooltip}
                  role="img"
                >
                  <Shield size={12} />
                </span>
                {asset.reasons.map((reason, index) => (
                  <ProtectedReasonIcon
                    key={reason}
                    reason={reason}
                    rawReason={asset.rawReasons?.[index]}
                  />
                ))}
              </div>
            </div>
            <div className="atlas-finances-asset-row__value">
              <strong>{asset.value}</strong>
              {asset.isTheoretical ? (
                <span
                  data-tooltip={theoreticalTooltip}
                  aria-label={theoreticalTooltip}
                  className="atlas-finances-theoretical-icon"
                  role="img"
                >
                  <Info size={14} />
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConflictsSection({
  financialStrategy,
  onSelectPlayer
}: {
  financialStrategy: FinancialStrategyState;
  onSelectPlayer: (playerId: string) => void;
}) {
  const conflicts = financialStrategy.viewModel?.conflicts ?? [];
  if (conflicts.length === 0) return null;
  return (
    <Section title="Strategic Conflicts">
      <ul className="atlas-finances-conflict-list">
        {conflicts.map((conflict, index) => (
          <li key={`${conflict.playerId ?? "club"}-${index}`}>
            <strong>
              {conflict.playerName && conflict.playerId !== null ? (
                <PlayerLink playerId={String(conflict.playerId)} onSelectPlayer={onSelectPlayer}>
                  {conflict.playerName}
                </PlayerLink>
              ) : (
                "Club strategy"
              )}
            </strong>
            <span>{conflict.description}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function PositionSignals({ reasons, warnings }: { reasons: string[]; warnings: string[] }) {
  if (reasons.length === 0 && warnings.length === 0) return null;
  return (
    <div className="atlas-finances-signals">
      {reasons.length > 0 ? (
        <div>
          <h3>Why</h3>
          <ul>
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div>
          <h3>Watch</h3>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CompactList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="atlas-finances-subsection">
      <h3>{title}</h3>
      <ul className="atlas-finances-compact-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: Array<[string, string, string]> }) {
  return (
    <div className="atlas-finances-metric-grid">
      {metrics.map(([label, value, meta]) => (
        <div className="atlas-finances-metric" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          <small>{meta}</small>
        </div>
      ))}
    </div>
  );
}

function Section({
  title,
  children,
  className = ""
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const id = `${title.toLowerCase().replaceAll(" ", "-")}-title`;
  return (
    <section className={`atlas-finances-panel ${className}`} aria-labelledby={id}>
      <h2 className="atlas-finances-panel__title atlas-section-title" id={id}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function PanelMessage({ children, tone }: { children: string; tone?: "error" }) {
  return <p className={`atlas-finances-panel__message${tone ? ` is-${tone}` : ""}`}>{children}</p>;
}

