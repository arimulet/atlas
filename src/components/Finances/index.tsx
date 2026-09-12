import type { ReactNode } from "react";
import { useState } from "react";
import { ArrowRight, Info, Search, Sliders, CheckCircle2 } from "lucide-react";
import { formatMoney } from "@/app/formatters";
import { formatSokkerSkill, skillLevelLabelEn } from "@/app/view-models/skill-level-label";
import { PlayerLink } from "@/components/PlayerLink";
import { StatusBadge } from "@/components/StatusBadge";
import { PositionBadge } from "@/components/PositionBadge";
import { registerPlayerCountries } from "@/context/PlayerCountryContext";
import { inferPositionFromSkills } from "@atlas/domain";
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
      <InvestmentSimulator financialStrategy={financialStrategy} />
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

const SOKKER_SKILL_COLUMNS = [
  [
    { key: "stamina", label: "stamina" },
    { key: "pace", label: "pace" },
    { key: "technique", label: "technique" },
    { key: "passing", label: "passing" }
  ],
  [
    { key: "keeper", label: "keeper" },
    { key: "defender", label: "defender" },
    { key: "playmaker", label: "playmaker" },
    { key: "striker", label: "striker" }
  ]
] as const;

const MANUAL_SKILL_COLUMNS = [
  [
    { label: "Stamina", key: "stamina" },
    { label: "Pace", key: "pace" },
    { label: "Technique", key: "technique" },
    { label: "Passing", key: "passing" }
  ],
  [
    { label: "Keeper", key: "keeper" },
    { label: "Defending", key: "defender" },
    { label: "Playmaking", key: "playmaker" },
    { label: "Scoring", key: "striker" }
  ]
] as const;

function InvestmentSimulator({ financialStrategy }: { financialStrategy: FinancialStrategyState }) {
  const [tab, setTab] = useState<"id" | "manual">("id");
  const [playerIdInput, setPlayerIdInput] = useState("");
  const [isSearchingPlayer, setIsSearchingPlayer] = useState(false);
  const [loadedPlayer, setLoadedPlayer] = useState<{
    playerId: number;
    name: string;
    age: number | null;
    position: string | null;
    skills: Record<string, number>;
    wage: number | null;
    marketValue: number | null;
  } | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  // Manual Form fields
  const [age, setAge] = useState("18");
  const [skills, setSkills] = useState<Record<string, number>>({
    stamina: 8,
    pace: 8,
    technique: 8,
    passing: 8,
    keeper: 1,
    defender: 8,
    playmaker: 8,
    striker: 8
  });

  const calculatedPosition = inferPositionFromSkills(skills);

  const handleSearchPlayer = async () => {
    const id = Number(playerIdInput);
    if (!Number.isFinite(id) || id <= 0) return;
    setIsSearchingPlayer(true);
    setLookupMessage(null);
    try {
      const res = await financialStrategy.lookupPlayer(id);
      if (res.found && res.player) {
        setLoadedPlayer(res.player);
        setLookupMessage(null);
      } else {
        setLoadedPlayer(null);
        setLookupMessage(res.message || "Player not found in local records.");
      }
    } catch {
      setLoadedPlayer(null);
      setLookupMessage("Error querying player.");
    } finally {
      setIsSearchingPlayer(false);
    }
  };

  const handleSkillChange = (key: string, value: string) => {
    const num = Math.max(0, Math.min(18, Number(value) || 0));
    setSkills((prev) => ({ ...prev, [key]: num }));
  };

  const handleSimulate = async () => {
    if (tab === "id") {
      const id = Number(playerIdInput);
      if (!Number.isFinite(id) || id <= 0) return;

      let player = loadedPlayer;
      if (!player) {
        setIsSearchingPlayer(true);
        try {
          const res = await financialStrategy.lookupPlayer(id);
          if (res.found && res.player) {
            player = res.player;
            setLoadedPlayer(res.player);
          }
        } catch {
          // ignore lookup error and try simulation with ID
        } finally {
          setIsSearchingPlayer(false);
        }
      }

      void financialStrategy.simulateAcquisition({
        playerId: id,
        name: player?.name,
        age: player?.age ?? null,
        position: player?.position ?? null,
        skills: player?.skills ?? {},
        weeklyWage: player?.wage ?? null
      });
    } else {
      void financialStrategy.simulateAcquisition({
        position: calculatedPosition,
        age: Number(age) || 18,
        skills
      });
    }
  };

  const result = financialStrategy.acquisitionResult;

  return (
    <Section title="Acquisition & Investment Simulator" className="atlas-finances-simulator-section">
      <div className="atlas-finances-simulator-tabs">
        <button
          type="button"
          className={`atlas-finances-simulator-tab${tab === "id" ? " is-active" : ""}`}
          onClick={() => setTab("id")}
        >
          <Search size={14} /> Search by Player ID
        </button>
        <button
          type="button"
          className={`atlas-finances-simulator-tab${tab === "manual" ? " is-active" : ""}`}
          onClick={() => setTab("manual")}
        >
          <Sliders size={14} /> Manual Skill Entry
        </button>
      </div>

      <div className="atlas-finances-simulator-card">
        {tab === "id" ? (
          <div className="atlas-finances-simulator-id-mode">
            <div className="atlas-finances-simulator-row">
              <label>
                <span>Player ID (Sokker)</span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 345678"
                    value={playerIdInput}
                    onChange={(e) => setPlayerIdInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleSearchPlayer();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSearchPlayer}
                    disabled={isSearchingPlayer || !playerIdInput}
                  >
                    {isSearchingPlayer ? "Searching..." : "Lookup"}
                  </button>
                </div>
              </label>
            </div>

            {lookupMessage ? (
              <p
                className={`atlas-finances-simulator-lookup-msg${
                  loadedPlayer ? " is-success" : " is-note"
                }`}
              >
                {loadedPlayer ? <CheckCircle2 size={14} /> : <Info size={14} />} {lookupMessage}
              </p>
            ) : null}

            {loadedPlayer ? (
              <div className="atlas-finances-simulator-loaded-card">
                <div className="atlas-finances-simulator-loaded-header">
                  <div className="atlas-finances-simulator-loaded-identity">
                    <strong className="atlas-finances-simulator-loaded-name">{loadedPlayer.name}</strong>
                    <span className="atlas-finances-simulator-loaded-age">
                      {loadedPlayer.age ? `${loadedPlayer.age} y/o` : "Age n/a"}
                    </span>
                    {loadedPlayer.position ? (
                      <PositionBadge position={loadedPlayer.position} size="sm" />
                    ) : null}
                  </div>
                  <div className="atlas-finances-simulator-loaded-meta">
                    {loadedPlayer.wage ? (
                      <span>Wage: {formatMoney({ amount: loadedPlayer.wage, currency: null, isComplete: true })}/wk</span>
                    ) : null}
                    {loadedPlayer.marketValue ? (
                      <span>Market: {formatMoney({ amount: loadedPlayer.marketValue, currency: null, isComplete: true })}</span>
                    ) : null}
                  </div>
                </div>

                <div className="atlas-finances-simulator-sokker-grid">
                  {SOKKER_SKILL_COLUMNS.map((col, colIdx) => (
                    <div className="atlas-finances-simulator-sokker-col" key={colIdx}>
                      {col.map((s) => {
                        const val = loadedPlayer.skills[s.key] ?? 0;
                        return (
                          <div className="atlas-finances-simulator-sokker-row" key={s.key}>
                            <span className="atlas-finances-simulator-sokker-label">{s.label}:</span>
                            <span className="atlas-finances-simulator-sokker-val">
                              {formatSokkerSkill(val)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="atlas-finances-simulator-submit-row">
              <button
                type="button"
                className="atlas-finances-simulator-submit-btn"
                onClick={handleSimulate}
                disabled={financialStrategy.isSimulatingAcquisition || !playerIdInput}
              >
                {financialStrategy.isSimulatingAcquisition
                  ? "Simulating impact..."
                  : "Simulate Acquisition & Impact"}
              </button>
            </div>
          </div>
        ) : (
          <div className="atlas-finances-simulator-manual-mode">
            <div className="atlas-finances-simulator-manual-columns">
              <div className="atlas-finances-simulator-manual-profile-col">
                <label className="atlas-finances-simulator-age-field">
                  <span>Age</span>
                  <input
                    type="number"
                    min="15"
                    max="40"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="18"
                  />
                </label>
              </div>

              <div className="atlas-finances-simulator-manual-skills-col">
                <span className="atlas-finances-simulator-skills-title">Skills (0 to 18)</span>
                <div className="atlas-finances-simulator-skills-columns">
                  {MANUAL_SKILL_COLUMNS.map((col, colIdx) => (
                    <dl key={colIdx} className="atlas-finances-simulator-skills-list">
                      {col.map(({ label, key }) => {
                        const val = skills[key] ?? 0;
                        const levelLabel = skillLevelLabelEn(val) ?? "tragic";
                        return (
                          <div key={key} className="atlas-finances-simulator-skill-row">
                            <dt className="atlas-finances-simulator-skill-name">{label}</dt>
                            <dd className="atlas-finances-simulator-skill-control">
                              <input
                                type="number"
                                min="0"
                                max="18"
                                value={val}
                                onChange={(e) => handleSkillChange(key, e.target.value)}
                                className="atlas-finances-simulator-skill-number-input"
                              />
                              <span className="atlas-finances-simulator-skill-level-label">({levelLabel})</span>
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  ))}
                </div>
              </div>
            </div>

            <div className="atlas-finances-simulator-submit-row">
              <button
                type="button"
                className="atlas-finances-simulator-submit-btn"
                onClick={handleSimulate}
                disabled={financialStrategy.isSimulatingAcquisition}
              >
                {financialStrategy.isSimulatingAcquisition
                  ? "Simulating impact..."
                  : "Simulate Acquisition & Impact"}
              </button>
            </div>
          </div>
        )}
      </div>

      {result ? (
        <div className="atlas-finances-simulator-results">
          {/* Card 1: Financial Health */}
          <div className="atlas-finances-simulator-result-card">
            <div className="atlas-finances-simulator-result-header">
              <h3>1. Financial & Payroll Impact</h3>
              <StatusBadge status={result.financial.safetyFormatted} />
            </div>
            <MetricGrid
              metrics={[
                [
                  "Estimated Transfer Fee",
                  result.financial.amountFormatted,
                  result.financial.marketPriceSource === "market_comparables"
                    ? `Derived from ${result.financial.comparableCount} market transfers`
                    : result.financial.marketPriceSource === "market_calibration"
                    ? "Calibrated against market transfers"
                    : result.financial.marketPriceSource === "user_specified"
                    ? "Specified investment fee"
                    : "Fundamental market valuation"
                ],
                [
                  "Projected Weekly Payroll",
                  result.financial.projectedWeeklyPayrollFormatted,
                  result.financial.weeklyWageFormatted
                    ? `+${result.financial.weeklyWageFormatted}/wk added (${result.financial.isWageEstimated ? "est." : "known"})`
                    : "No wage increase"
                ],
                [
                  "Post-deal cash",
                  result.financial.postInvestmentCashFormatted,
                  "Remaining treasury"
                ],
                [
                  "Payroll coverage",
                  result.financial.postInvestmentPayrollCoverageWeeksFormatted,
                  `Before: ${result.financial.currentPayrollCoverageWeeksFormatted}`
                ],
                [
                  "Investment safety",
                  result.financial.safetyFormatted,
                  "Risk classification"
                ]
              ]}
            />
          </div>

          {/* Card 2: Squad Fit & Depth */}
          <div className="atlas-finances-simulator-result-card">
            <div className="atlas-finances-simulator-result-header">
              <h3>2. Squad Fit & Depth</h3>
              <span
                className={`atlas-squad-planning-badge is-${result.squadFit.projectedHierarchy}`}
              >
                {result.squadFit.projectedHierarchy === "starter"
                  ? "Projected Starter"
                  : result.squadFit.projectedHierarchy === "rotation"
                  ? "Rotation"
                  : "Reserve / Depth"}
              </span>
            </div>
            <div className="atlas-finances-simulator-fit-body">
              <strong className="atlas-finances-simulator-fit-title">
                {result.squadFit.headline}
              </strong>
              <p>{result.squadFit.description}</p>
            </div>
          </div>

          {/* Card 3: Training */}
          <div className="atlas-finances-simulator-result-card">
            <div className="atlas-finances-simulator-result-header">
              <h3>3. Training & Slot Capacity</h3>
              <span
                className={`atlas-finances-simulator-chip${
                  result.training.isCompatibleWithClubTraining ? " is-active" : " is-inactive"
                }`}
              >
                {result.training.isCompatibleWithClubTraining ? "Compatible" : "No training"}
              </span>
            </div>
            <div className="atlas-finances-simulator-fit-body">
              <strong className="atlas-finances-simulator-fit-title">
                {result.training.headline}
              </strong>
              <p>{result.training.description}</p>
            </div>
          </div>

          {/* Card 4: Youth ROI (<= 21 y/o) */}
          {result.roi?.isYouthProjectable ? (
            <div className="atlas-finances-simulator-result-card is-roi">
              <div className="atlas-finances-simulator-result-header">
                <h3>4. Youth ROI & Resale Projection</h3>
                <span className={`atlas-finances-simulator-chip is-${result.roi.verdict}`}>
                  {result.roi.verdict === "high_upside"
                    ? "High Upside"
                    : result.roi.verdict === "moderate_upside"
                    ? "Positive Return"
                    : result.roi.verdict === "break_even"
                    ? "Break-even"
                    : "Deficit / Loss"}
                </span>
              </div>
              <div className="atlas-finances-simulator-fit-body">
                <strong className="atlas-finances-simulator-fit-title">
                  {result.roi.headline}
                </strong>
                <p>{result.roi.description}</p>
              </div>
              <div className="atlas-finances-simulator-roi-grid">
                <div className="atlas-finances-simulator-roi-col">
                  <span>After 1 Season (16 wks)</span>
                  <strong>{result.roi.projectedValueSeason1Formatted}</strong>
                  <small>Total cost: {result.roi.totalCostSeason1Formatted}</small>
                  <em
                    className={
                      result.roi.netMarginSeason1 && result.roi.netMarginSeason1 > 0
                        ? "is-profit"
                        : "is-loss"
                    }
                  >
                    Net: {result.roi.netMarginSeason1Formatted} (
                    {(result.roi.roiPercentSeason1 ?? 0) > 0 ? "+" : ""}
                    {result.roi.roiPercentSeason1}%)
                  </em>
                </div>
                <div className="atlas-finances-simulator-roi-col">
                  <span>After 2 Seasons (32 wks)</span>
                  <strong>{result.roi.projectedValueSeason2Formatted}</strong>
                  <small>Total cost: {result.roi.totalCostSeason2Formatted}</small>
                  <em
                    className={
                      result.roi.netMarginSeason2 && result.roi.netMarginSeason2 > 0
                        ? "is-profit"
                        : "is-loss"
                    }
                  >
                    Net: {result.roi.netMarginSeason2Formatted} (
                    {(result.roi.roiPercentSeason2 ?? 0) > 0 ? "+" : ""}
                    {result.roi.roiPercentSeason2}%)
                  </em>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="atlas-finances-panel__note">
          Multidimensional acquisition simulation: evaluates cash reserves, weekly payroll, squad depth deficits, training slots, and future resale value without modifying real club data.
        </p>
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
      {assets.monetizable.length > 0 ? (
        <AssetList
          title="Potential Liquidity"
          assets={assets.monetizable}
          onSelectPlayer={onSelectPlayer}
        />
      ) : null}
      {assets.protectedAssets.length > 0 ? (
        <div className="atlas-finances-subsection">
          <h3>Protected Strategic Assets</h3>
          <ul className="atlas-finances-asset-list">
            {assets.protectedAssets.map((asset) => (
              <li key={asset.playerId}>
                <PlayerLink playerId={String(asset.playerId)} onSelectPlayer={onSelectPlayer}>
                  {asset.name}
                </PlayerLink>
                <strong>
                  {asset.value}
                  {asset.isTheoretical ? (
                    <span title="Tasación teórica" className="atlas-finances-theoretical-icon" style={{ cursor: "help", marginLeft: "6px", opacity: 0.6, display: "inline-flex", verticalAlign: "text-bottom" }}>
                      <Info size={16} />
                    </span>
                  ) : null}
                </strong>
                <small>{asset.reasons.join(" · ")}</small>
              </li>
            ))}
          </ul>
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

function AssetList({
  title,
  assets,
  onSelectPlayer
}: {
  title: string;
  assets: NonNullable<FinancialStrategyState["viewModel"]>["assets"]["monetizable"];
  onSelectPlayer: (playerId: string) => void;
}) {
  return (
    <div className="atlas-finances-subsection">
      <h3>{title}</h3>
      <ul className="atlas-finances-asset-list">
        {assets.map((asset) => (
          <li key={asset.playerId}>
            <PlayerLink playerId={String(asset.playerId)} onSelectPlayer={onSelectPlayer}>
              {asset.name}
            </PlayerLink>
            <strong>
              {asset.value}
              {asset.isTheoretical ? (
                <span title="Tasación teórica" className="atlas-finances-theoretical-icon" style={{ cursor: "help", marginLeft: "6px", opacity: 0.6, display: "inline-flex", verticalAlign: "text-bottom" }}>
                  <Info size={16} />
                </span>
              ) : null}
            </strong>
            <small>
              {asset.role} · Liquidity potential: {asset.liquidity}
              {asset.recommended ? " · Recommended monetization" : ""}
            </small>
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

