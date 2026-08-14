import { useMemo, useState } from "react";

import type { Severity } from "@atlas/web/app/types";
import {
  createDiagnosticsPageViewModel,
  type DiagnosticArea,
  type DiagnosticViewModel
} from "../../view-models/diagnostics-view-model";
import type { DiagnosticsV2Props } from "./types";

type SeverityFilter = "all" | Severity;
type AreaFilter = "all" | DiagnosticArea;

const severityOrder: Severity[] = ["high", "medium", "low", "info"];
const areaOrder: DiagnosticArea[] = ["Training", "Squad", "Youth", "Player"];

export function DiagnosticsV2({
  dashboardStatus,
  development,
  onSelectPlayer,
  training,
  trainingDiagnostic,
  trainingStatus,
  youthAcademy,
  youthPipeline,
  youthPipelineStatus,
  youthStatus
}: DiagnosticsV2Props) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [areaFilter, setAreaFilter] = useState<AreaFilter>("all");
  const viewModel = useMemo(
    () =>
      createDiagnosticsPageViewModel({
        development,
        training,
        trainingDiagnostic,
        youthAcademy,
        youthPipeline
      }),
    [development, training, trainingDiagnostic, youthAcademy, youthPipeline]
  );
  const severityOptions = severityOrder.filter((severity) =>
    viewModel.diagnostics.some((diagnostic) => diagnostic.severity === severity)
  );
  const areaOptions = areaOrder.filter((area) =>
    viewModel.diagnostics.some((diagnostic) => diagnostic.area === area)
  );
  const filteredDiagnostics = viewModel.diagnostics.filter(
    (diagnostic) =>
      (severityFilter === "all" || diagnostic.severity === severityFilter) &&
      (areaFilter === "all" || diagnostic.area === areaFilter)
  );
  const isLoading = [dashboardStatus, trainingStatus, youthStatus, youthPipelineStatus].includes(
    "loading"
  );
  const hasSources = [dashboardStatus, trainingStatus, youthStatus, youthPipelineStatus].some(
    (status) => status !== "idle"
  );

  return (
    <div className="v2-diagnostics">
      <header className="v2-diagnostics__header">
        <h1>Diagnostics</h1>
      </header>

      <DiagnosticSummary viewModel={viewModel} />

      <section className="v2-diagnostics__filters" aria-labelledby="diagnostics-filters-title">
        <h2 id="diagnostics-filters-title" className="v2-diagnostics__section-label">
          Filters
        </h2>
        <div className="v2-diagnostics-filter-group" aria-label="Severity">
          <span className="v2-diagnostics-filter-group__label">Severity</span>
          <div className="v2-diagnostics-filter-buttons">
            <FilterButton
              isActive={severityFilter === "all"}
              label="All"
              onClick={() => setSeverityFilter("all")}
            />
            {severityOptions.map((severity) => (
              <FilterButton
                isActive={severityFilter === severity}
                key={severity}
                label={severityLabel(severity)}
                onClick={() => setSeverityFilter(severity)}
              />
            ))}
          </div>
        </div>

        <label className="v2-diagnostics-area-filter">
          <span>Area</span>
          <select
            aria-label="Area"
            value={areaFilter}
            onChange={(event) => setAreaFilter(event.target.value as AreaFilter)}
          >
            <option value="all">All</option>
            {areaOptions.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="v2-diagnostics__list" aria-labelledby="all-diagnostics-title">
        <div className="v2-diagnostics__list-header">
          <h2 id="all-diagnostics-title">All Diagnostics</h2>
          {viewModel.summary.total > 0 ? (
            <span>
              {filteredDiagnostics.length} of {viewModel.summary.total}
            </span>
          ) : null}
        </div>

        {isLoading ? <DiagnosticsMessage>Loading diagnostics...</DiagnosticsMessage> : null}
        {!isLoading && !hasSources ? (
          <DiagnosticsMessage>Import a club snapshot to inspect diagnostics.</DiagnosticsMessage>
        ) : null}
        {!isLoading && hasSources && viewModel.summary.total === 0 ? (
          <DiagnosticsMessage tone="clear">✓ No issues requiring attention</DiagnosticsMessage>
        ) : null}
        {!isLoading && viewModel.summary.total > 0 && filteredDiagnostics.length === 0 ? (
          <DiagnosticsMessage>No diagnostics match the selected filters.</DiagnosticsMessage>
        ) : null}
        {!isLoading && filteredDiagnostics.length > 0 ? (
          <DiagnosticsTable diagnostics={filteredDiagnostics} onSelectPlayer={onSelectPlayer} />
        ) : null}
      </section>
    </div>
  );
}

interface DiagnosticSummaryProps {
  viewModel: ReturnType<typeof createDiagnosticsPageViewModel>;
}

function DiagnosticSummary({ viewModel }: DiagnosticSummaryProps) {
  const severities = severityOrder.filter((severity) => viewModel.summary.bySeverity[severity]);

  return (
    <section className="v2-diagnostics-summary" aria-labelledby="diagnostic-summary-title">
      <h2 id="diagnostic-summary-title">Diagnostic Summary</h2>
      <div className="v2-diagnostics-summary__content">
        <span className="v2-diagnostics-summary__eyebrow">Diagnostics</span>
        {severities.length > 0 ? (
          <div className="v2-diagnostics-summary__counters">
            {severities.map((severity) => (
              <span className={`v2-diagnostics-summary__counter is-${severity}`} key={severity}>
                <strong>{viewModel.summary.bySeverity[severity]}</strong>
                <span>{severityLabel(severity)}</span>
              </span>
            ))}
          </div>
        ) : (
          <span className="v2-diagnostics-summary__empty">No current signals</span>
        )}
      </div>
    </section>
  );
}

interface FilterButtonProps {
  isActive: boolean;
  label: string;
  onClick: () => void;
}

function FilterButton({ isActive, label, onClick }: FilterButtonProps) {
  return (
    <button
      className={`v2-diagnostics-filter-button${isActive ? " is-active" : ""}`}
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

interface DiagnosticsTableProps {
  diagnostics: DiagnosticViewModel[];
  onSelectPlayer: (playerId: string) => void;
}

function DiagnosticsTable({ diagnostics, onSelectPlayer }: DiagnosticsTableProps) {
  const showContext = diagnostics.some((diagnostic) => diagnostic.context);

  return (
    <div className="v2-diagnostics-table-wrap">
      <table className="v2-diagnostics-table">
        <thead>
          <tr>
            <th scope="col">Severity</th>
            <th scope="col">Area</th>
            <th scope="col">Subject</th>
            <th scope="col">Diagnostic</th>
            {showContext ? <th scope="col">Context</th> : null}
          </tr>
        </thead>
        <tbody>
          {diagnostics.map((diagnostic) => (
            <DiagnosticRow
              diagnostic={diagnostic}
              key={diagnostic.id}
              onSelectPlayer={onSelectPlayer}
              showContext={showContext}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface DiagnosticRowProps {
  diagnostic: DiagnosticViewModel;
  onSelectPlayer: (playerId: string) => void;
  showContext: boolean;
}

function DiagnosticRow({ diagnostic, onSelectPlayer, showContext }: DiagnosticRowProps) {
  const canNavigateToPlayer = diagnostic.subject?.type === "player" && diagnostic.subject.id;

  return (
    <tr>
      <td>
        <span className={`v2-diagnostics-severity is-${diagnostic.severity}`}>
          {severityLabel(diagnostic.severity)}
        </span>
      </td>
      <td>
        <span className="v2-diagnostics-area">{diagnostic.area}</span>
      </td>
      <td>
        {canNavigateToPlayer ? (
          <button
            className="v2-diagnostics-subject-link"
            type="button"
            onClick={() => onSelectPlayer(diagnostic.subject!.id!)}
          >
            {diagnostic.subject?.label}
          </button>
        ) : (
          <span className="v2-diagnostics-subject">{diagnostic.subject?.label ?? "—"}</span>
        )}
      </td>
      <td className="v2-diagnostics-message">{diagnostic.message}</td>
      {showContext ? <td className="v2-diagnostics-context">{diagnostic.context ?? "—"}</td> : null}
    </tr>
  );
}

interface DiagnosticsMessageProps {
  children: string;
  tone?: "clear";
}

function DiagnosticsMessage({ children, tone }: DiagnosticsMessageProps) {
  return <p className={`v2-diagnostics-message-state${tone ? ` is-${tone}` : ""}`}>{children}</p>;
}

function severityLabel(severity: Severity): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}
