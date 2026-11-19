"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { CheckCircle2, Info, Search, Sliders } from "lucide-react";
import { formatMoney } from "@/app/formatters";
import { formatSokkerSkill, skillLevelLabelEn } from "@/app/view-models/skill-level-label";
import { DevelopmentResults } from "./DevelopmentResults";
import { PositionBadge } from "@/components/PositionBadge";
import { inferPositionFromSkills } from "@atlas/domain";
import { MAX_SKILL_LEVEL, MAX_STAMINA_LEVEL } from "../../domain/training/constants";
import type { FinancialStrategyState } from "@/app/features/financialStrategy/useFinancialStrategy";

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

export function InvestmentSimulator({
  financialStrategy
}: {
  financialStrategy: FinancialStrategyState;
}) {
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
    if (!Number.isInteger(id) || id <= 0) return;
    setIsSearchingPlayer(true);
    setLookupMessage(null);
    try {
      const res = await financialStrategy.lookupPlayer(id);
      if (res.found && res.player) {
        setLoadedPlayer(res.player);
        setLookupMessage(`Player loaded from Sokker: ${res.player.name}`);
      } else {
        setLoadedPlayer(null);
        setLookupMessage(res.message || "Player not found in Sokker.");
      }
    } catch (error) {
      setLoadedPlayer(null);
      setLookupMessage(error instanceof Error ? error.message : "Error querying Sokker.");
    } finally {
      setIsSearchingPlayer(false);
    }
  };

  const handleSkillChange = (key: string, value: string) => {
    const maximum = key === "stamina" ? MAX_STAMINA_LEVEL : MAX_SKILL_LEVEL;
    const num = Math.max(0, Math.min(maximum, Number(value) || 0));
    setSkills((prev) => ({ ...prev, [key]: num }));
  };

  const handleSimulate = async () => {
    if (tab === "id") {
      const id = Number(playerIdInput);
      if (!Number.isFinite(id) || id <= 0) return;

      const player = loadedPlayer;
      if (!player || player.playerId !== id) return;

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
    <Section
      title="Acquisition & Investment Simulator"
      className="atlas-finances-simulator-section"
    >
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
                    onChange={(e) => { setPlayerIdInput(e.target.value); setLoadedPlayer(null); setLookupMessage(null); }}
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
                    <strong className="atlas-finances-simulator-loaded-name">
                      {loadedPlayer.name}
                    </strong>
                    <span className="atlas-finances-simulator-loaded-age">
                      {loadedPlayer.age ? `${loadedPlayer.age} y/o` : "Age n/a"}
                    </span>
                    {loadedPlayer.position ? (
                      <PositionBadge position={loadedPlayer.position} size="sm" />
                    ) : null}
                  </div>
                  <div className="atlas-finances-simulator-loaded-meta">
                    {loadedPlayer.wage ? (
                      <span>
                        Wage:{" "}
                        {formatMoney({
                          amount: loadedPlayer.wage,
                          currency: null,
                          isComplete: true
                        })}
                        /wk
                      </span>
                    ) : null}
                    {loadedPlayer.marketValue ? (
                      <span>
                        Market:{" "}
                        {formatMoney({
                          amount: loadedPlayer.marketValue,
                          currency: null,
                          isComplete: true
                        })}
                      </span>
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
                            <span className="atlas-finances-simulator-sokker-label">
                              {s.label}:
                            </span>
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
                disabled={financialStrategy.isSimulatingAcquisition || !loadedPlayer || loadedPlayer.playerId !== Number(playerIdInput)}
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
                <span className="atlas-finances-simulator-skills-title">Skills (0 to 18; stamina 0 to 11)</span>
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
                                max={key === "stamina" ? MAX_STAMINA_LEVEL : MAX_SKILL_LEVEL}
                                value={val}
                                onChange={(e) => handleSkillChange(key, e.target.value)}
                                className="atlas-finances-simulator-skill-number-input"
                              />
                              <span className="atlas-finances-simulator-skill-level-label">
                                ({levelLabel})
                              </span>
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
          <DevelopmentResults
            result={result}
            currentGameWeek={financialStrategy.currentGameWeek}
            onRecalculateTargets={financialStrategy.recalculateAcquisitionTargets}
            isRecalculating={financialStrategy.isSimulatingAcquisition}
          />
        </div>
      ) : (
        <p className="atlas-finances-panel__note">
          Multidimensional acquisition simulation: evaluates cash reserves, weekly payroll, squad
          depth deficits, training slots, and future resale value without modifying real club data.
        </p>
      )}
    </Section>
  );
}
