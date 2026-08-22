import { PlayerLink } from "../../components/PlayerLink";
import { formatPercentage } from "../../formatters";
import type { TrainingPageData } from "../../types";
import {
  createTrainingIntelligenceViewModel,
  type AdvancedSlotReplacementViewModel,
  type AdvancedTrainingSlotRow,
  type TrainingAttentionItem,
  type TrainingIntelligenceViewModel
} from "./training-intelligence-view-model";
import { useWeeklyTrainingIntelligence } from "./useWeeklyTrainingIntelligence";

interface WeeklyTrainingIntelligenceProps {
  clubId: string | null;
  onSelectPlayer: (playerId: string) => void;
  training: TrainingPageData | null;
}

export function WeeklyTrainingIntelligence({
  clubId,
  onSelectPlayer,
  training
}: WeeklyTrainingIntelligenceProps) {
  const { data, error, isLoading } = useWeeklyTrainingIntelligence(clubId);
  if (isLoading) {
    return (
      <IntelligencePanelMessage>Loading Weekly Training Intelligence...</IntelligencePanelMessage>
    );
  }

  if (error) {
    return (
      <IntelligencePanelMessage tone="error">
        Weekly Training Intelligence is unavailable. Training data remains available below.
      </IntelligencePanelMessage>
    );
  }

  if (!data || !training) {
    return (
      <IntelligencePanelMessage>No training data available for this week.</IntelligencePanelMessage>
    );
  }

  return (
    <WeeklyTrainingIntelligenceContent
      data={createTrainingIntelligenceViewModel({ training, intelligence: data })}
      onSelectPlayer={onSelectPlayer}
    />
  );
}

interface WeeklyTrainingIntelligenceContentProps {
  data: TrainingIntelligenceViewModel;
  onSelectPlayer: (playerId: string) => void;
}

function WeeklyTrainingIntelligenceContent({
  data,
  onSelectPlayer
}: WeeklyTrainingIntelligenceContentProps) {
  return (
    <section className="atlas-training-intelligence" aria-labelledby="weekly-intelligence-title">
      <div className="atlas-training-intelligence__heading">
        <div>
          <span className="atlas-training-intelligence__eyebrow">Training</span>
          <h2 id="weekly-intelligence-title">Weekly Training Intelligence</h2>
        </div>
        <span className="atlas-training-intelligence__week">
          Week {data.summary.gameWeek} · {formatWeekDate(data.summary.date)}
        </span>
      </div>

      <TrainingWeeklySummary summary={data.summary} />
      <TrainingAttentionList items={data.attention} onSelectPlayer={onSelectPlayer} />
      <AdvancedTrainingSlots data={data} onSelectPlayer={onSelectPlayer} />
    </section>
  );
}

interface TrainingWeeklySummaryProps {
  summary: TrainingIntelligenceViewModel["summary"];
}

function TrainingWeeklySummary({ summary }: TrainingWeeklySummaryProps) {
  const metrics = [
    [summary.trainedPlayers, "trained"],
    [summary.advancedPlayers, "advanced"],
    [summary.formationPlayers, "formation"],
    [summary.skillUps, "skill-ups"],
    [formatPercentage(summary.averageIntensity), "avg intensity"]
  ] as const;

  return (
    <section className="atlas-training-intelligence__summary" aria-label="Weekly summary">
      {metrics.map(([value, label]) => (
        <div className="atlas-training-intelligence__metric" key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </section>
  );
}

interface TrainingAttentionListProps {
  items: readonly TrainingAttentionItem[];
  onSelectPlayer: (playerId: string) => void;
}

function TrainingAttentionList({ items, onSelectPlayer }: TrainingAttentionListProps) {
  return (
    <section
      className="atlas-training-intelligence__section atlas-training-intelligence__section--attention"
      aria-labelledby="training-intelligence-attention-title"
    >
      <SectionHeading id="training-intelligence-attention-title" title="Attention Required" />
      {items.length === 0 ? (
        <IntelligencePanelMessage>
          No training changes recommended this week.
        </IntelligencePanelMessage>
      ) : (
        <div className="atlas-training-intelligence__attention-list">
          {items.map((item, index) => (
            <AttentionCard
              item={item}
              key={`${item.type}-${item.playerId}-${index}`}
              onSelectPlayer={onSelectPlayer}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface AttentionCardProps {
  item: TrainingAttentionItem;
  onSelectPlayer: (playerId: string) => void;
}

function AttentionCard({ item, onSelectPlayer }: AttentionCardProps) {
  return (
    <article className={`atlas-training-intelligence__attention-card is-${item.priority}`}>
      <span className="atlas-training-intelligence__attention-icon" aria-hidden="true">
        {item.type === "slot_replacement" ? "↕" : item.type === "recent_skill_up" ? "↑" : "!"}
      </span>
      <div className="atlas-training-intelligence__attention-copy">
        <strong>{item.title}</strong>
        <p>{item.description}</p>
      </div>
      {item.action ? (
        <button type="button" onClick={() => onSelectPlayer(String(item.playerId))}>
          {item.action.label}
        </button>
      ) : null}
    </article>
  );
}

interface AdvancedTrainingSlotsProps {
  data: TrainingIntelligenceViewModel;
  onSelectPlayer: (playerId: string) => void;
}

function AdvancedTrainingSlots({ data, onSelectPlayer }: AdvancedTrainingSlotsProps) {
  return (
    <section
      className="atlas-training-intelligence__section"
      aria-labelledby="advanced-slots-title"
    >
      <div className="atlas-training-intelligence__section-heading">
        <SectionHeading id="advanced-slots-title" title="Advanced Training Slots" />
        <span className="atlas-training-intelligence__slot-count">
          {data.currentSlotCount} / {data.slotCount} slots
        </span>
      </div>

      {data.replacements.length > 0 ? (
        <div className="atlas-training-intelligence__replacements" aria-label="Suggested changes">
          {data.replacements.map((replacement) => (
            <AdvancedSlotReplacement
              key={`${replacement.promotePlayerId}-${replacement.removePlayerId}`}
              onSelectPlayer={onSelectPlayer}
              replacement={replacement}
            />
          ))}
        </div>
      ) : null}

      {data.advancedRows.length > 0 ? (
        <div className="atlas-training-intelligence__table-wrap">
          <table className="atlas-training-intelligence__table">
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Player</th>
                <th scope="col">Age</th>
                <th scope="col">Position</th>
                <th scope="col">Training</th>
                <th scope="col">Status</th>
                <th scope="col">Score</th>
              </tr>
            </thead>
            <tbody>
              {data.advancedRows.map((row) => (
                <AdvancedSlotRow key={row.playerId} onSelectPlayer={onSelectPlayer} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <IntelligencePanelMessage>
          No eligible advanced training candidates this week.
        </IntelligencePanelMessage>
      )}
    </section>
  );
}

interface AdvancedSlotReplacementProps {
  onSelectPlayer: (playerId: string) => void;
  replacement: AdvancedSlotReplacementViewModel;
}

function AdvancedSlotReplacement({ onSelectPlayer, replacement }: AdvancedSlotReplacementProps) {
  return (
    <article className="atlas-training-intelligence__replacement">
      <span className="atlas-training-intelligence__replacement-label">Suggested change</span>
      <div className="atlas-training-intelligence__replacement-players">
        <PlayerLink playerId={String(replacement.promotePlayerId)} onSelectPlayer={onSelectPlayer}>
          {`↑ ${replacement.promotePlayerName}`}
        </PlayerLink>
        <span aria-hidden="true">→</span>
        <PlayerLink playerId={String(replacement.removePlayerId)} onSelectPlayer={onSelectPlayer}>
          {`↓ ${replacement.removePlayerName}`}
        </PlayerLink>
      </div>
      <p>{replacement.description}</p>
    </article>
  );
}

interface AdvancedSlotRowProps {
  onSelectPlayer: (playerId: string) => void;
  row: AdvancedTrainingSlotRow;
}

function AdvancedSlotRow({ onSelectPlayer, row }: AdvancedSlotRowProps) {
  return (
    <tr className={row.recommendedAdvanced ? "is-recommended" : "is-outside"}>
      <td className="atlas-training-intelligence__numeric">#{row.rank}</td>
      <th scope="row">
        <PlayerLink playerId={String(row.playerId)} onSelectPlayer={onSelectPlayer}>
          {row.playerName}
        </PlayerLink>
      </th>
      <td className="atlas-training-intelligence__numeric">{row.age ?? "—"}</td>
      <td>{row.position}</td>
      <td>
        {row.recommendedSkill ? `${row.currentSkill} → ${row.recommendedSkill}` : row.currentSkill}
      </td>
      <td>
        <span className="atlas-training-intelligence__status">
          <span aria-hidden="true">{statusIcon(row.status)}</span> {row.status}
        </span>
      </td>
      <td className="atlas-training-intelligence__numeric atlas-training-intelligence__secondary">
        {row.score === null ? "—" : row.score.toFixed(2)}
      </td>
    </tr>
  );
}

interface SectionHeadingProps {
  id: string;
  title: string;
}

function SectionHeading({ id, title }: SectionHeadingProps) {
  return (
    <h3 className="atlas-training-intelligence__title" id={id}>
      {title}
    </h3>
  );
}

interface IntelligencePanelMessageProps {
  children: string;
  tone?: "error";
}

function IntelligencePanelMessage({ children, tone }: IntelligencePanelMessageProps) {
  return (
    <p className={`atlas-training-intelligence__message${tone ? ` is-${tone}` : ""}`}>{children}</p>
  );
}

function statusIcon(status: string): string {
  if (status === "Promote") return "↑";
  if (status === "Remove") return "↓";
  if (status === "Hold") return "!";
  return "•";
}

function formatWeekDate(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? "date unavailable"
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
