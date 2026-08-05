import "./popup.css";
import type { ExtractionResult, PlayerSnapshotExport } from "./types";

interface RuntimeExtractionResponse {
  ok: boolean;
  result?: ExtractionResult;
  error?: string;
}

const appRoot = document.querySelector<HTMLElement>("#app");

if (!appRoot) {
  throw new Error("Missing popup root.");
}

const app = appRoot;

let latestSnapshot: PlayerSnapshotExport | null = null;

renderIdle();

function renderIdle() {
  latestSnapshot = null;
  app.innerHTML = `
    <section class="shell">
      <header>
        <p class="eyebrow">ATLAS</p>
        <h1>Snapshot export</h1>
      </header>
      <p class="status">Open a compatible Sokker squad page, then generate a preview.</p>
      <button id="extract" type="button">Generate preview</button>
      <section class="notice">
        <strong>Manual export only.</strong>
        <span>No clicks, navigation, login actions, or network sync are performed.</span>
      </section>
    </section>
  `;

  app.querySelector("#extract")?.addEventListener("click", () => {
    void extractFromActiveTab();
  });
}

async function extractFromActiveTab() {
  setBusy();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      renderError("No active tab was found.");
      return;
    }

    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: "ATLAS_EXTRACT_SNAPSHOT"
    })) as RuntimeExtractionResponse | undefined;

    if (!response?.ok || !response.result) {
      renderError(response?.error ?? "This page is not available to the ATLAS exporter.");
      return;
    }

    latestSnapshot = response.result.snapshot;
    renderPreview(response.result);
  } catch (error) {
    renderError(error instanceof Error ? error.message : "Could not read the active Sokker page.");
  }
}

function setBusy() {
  app.innerHTML = `
    <section class="shell">
      <header>
        <p class="eyebrow">ATLAS</p>
        <h1>Snapshot export</h1>
      </header>
      <p class="status">Reading visible player data...</p>
    </section>
  `;
}

function renderError(message: string) {
  latestSnapshot = null;
  app.innerHTML = `
    <section class="shell">
      <header>
        <p class="eyebrow">ATLAS</p>
        <h1>Snapshot export</h1>
      </header>
      <p class="status error">${escapeHtml(message)}</p>
      <button id="retry" type="button">Try again</button>
    </section>
  `;

  app.querySelector("#retry")?.addEventListener("click", () => {
    void extractFromActiveTab();
  });
}

function renderPreview(result: ExtractionResult) {
  const snapshot = result.snapshot;
  const fileName = createFileName(snapshot);
  const warnings = result.warnings
    .slice(0, 8)
    .map((warning) => `<li><code>${escapeHtml(warning.path)}</code> ${escapeHtml(warning.message)}</li>`)
    .join("");

  app.innerHTML = `
    <section class="shell">
      <header>
        <p class="eyebrow">ATLAS</p>
        <h1>Snapshot export</h1>
      </header>
      <section class="summary">
        <div><span>Club</span><strong>${escapeHtml(snapshot.club.name)}</strong></div>
        <div><span>Date</span><strong>${snapshot.snapshot.snapshotDate}</strong></div>
        <div><span>Players</span><strong>${snapshot.players.length}</strong></div>
        <div><span>Schema</span><strong>${snapshot.schemaVersion}</strong></div>
      </section>
      ${warnings ? `<ul class="warnings">${warnings}</ul>` : ""}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>Value</th>
              <th>Wage</th>
            </tr>
          </thead>
          <tbody>
            ${snapshot.players.map(playerRow).join("")}
          </tbody>
        </table>
      </div>
      <textarea readonly spellcheck="false">${escapeHtml(JSON.stringify(snapshot, null, 2))}</textarea>
      <div class="actions">
        <button id="refresh" type="button" class="secondary">Refresh</button>
        <button id="download" type="button">Download JSON</button>
      </div>
      <p class="file-name">${escapeHtml(fileName)}</p>
    </section>
  `;

  app.querySelector("#refresh")?.addEventListener("click", () => {
    void extractFromActiveTab();
  });
  app.querySelector("#download")?.addEventListener("click", () => downloadSnapshot(fileName));
}

function playerRow(player: PlayerSnapshotExport["players"][number]): string {
  return `
    <tr>
      <td>${escapeHtml(player.name)}</td>
      <td>${player.age}</td>
      <td>${formatMoney(player.estimatedValue)}</td>
      <td>${formatMoney(player.wage)}</td>
    </tr>
  `;
}

function downloadSnapshot(fileName: string) {
  if (!latestSnapshot) {
    renderError("Generate a preview before downloading.");
    return;
  }

  const json = JSON.stringify(latestSnapshot, null, 2);
  const url = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;

  void chrome.downloads.download({
    url,
    filename: fileName,
    saveAs: true
  });
}

function createFileName(snapshot: PlayerSnapshotExport): string {
  const club = snapshot.club.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return `atlas-player-snapshot-${club || "club"}-${snapshot.snapshot.snapshotDate}.json`;
}

function formatMoney(money: { amount: number; currency: string | null }): string {
  return `${money.currency ?? "?"} ${money.amount.toLocaleString("en-US")}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character]!;
  });
}
