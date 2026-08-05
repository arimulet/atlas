import {
  PLAYER_SNAPSHOT_SCHEMA_VERSION,
  type ExtractionResult,
  type ExtractionWarning,
  type PlayerExport,
  type SkillKey
} from "./types";

const skillKeys = [
  "stamina",
  "pace",
  "technique",
  "passing",
  "keeper",
  "defender",
  "playmaker",
  "striker"
] as const satisfies SkillKey[];

const skillLabels: Record<SkillKey, string[]> = {
  stamina: ["stamina", "condition", "condicion", "resistencia"],
  pace: ["pace", "speed", "rapidez", "velocidad"],
  technique: ["technique", "tecnica", "technical"],
  passing: ["passing", "passes", "pases", "pase"],
  keeper: ["keeper", "goalkeeper", "porteria", "portero", "arquero"],
  defender: ["defender", "defence", "defense", "defensa"],
  playmaker: ["playmaker", "playmaking", "creacion", "organizacion", "jugadas"],
  striker: ["striker", "scorer", "scoring", "anotacion", "delantero"]
};

const fieldLabels = {
  name: ["name", "nombre", "player", "jugador"],
  age: ["age", "edad"],
  wage: ["wage", "salary", "salario", "sueldo"],
  estimatedValue: ["value", "estimated value", "valor", "valor estimado"],
  form: ["form", "forma"],
  observedPosition: ["position", "pos", "role", "posicion", "rol"],
  availabilityStatus: ["status", "availability", "estado", "disponibilidad"]
};

const textualSkillValues = new Map<string, number>([
  ["tragic", 0],
  ["hopeless", 1],
  ["unsatisfactory", 2],
  ["poor", 3],
  ["weak", 4],
  ["average", 5],
  ["adequate", 6],
  ["good", 7],
  ["solid", 8],
  ["very good", 9],
  ["excellent", 10],
  ["formidable", 11],
  ["outstanding", 12],
  ["incredible", 13],
  ["brilliant", 14],
  ["magical", 15],
  ["unearthly", 16],
  ["divine", 17],
  ["superdivine", 18],
  ["tragico", 0],
  ["sin esperanza", 1],
  ["insatisfactorio", 2],
  ["pobre", 3],
  ["debil", 4],
  ["regular", 5],
  ["adecuado", 6],
  ["bueno", 7],
  ["solido", 8],
  ["muy bueno", 9],
  ["excelente", 10],
  ["formidable", 11],
  ["destacado", 12],
  ["increible", 13],
  ["brillante", 14],
  ["magico", 15],
  ["sobrenatural", 16],
  ["divino", 17],
  ["superdivino", 18]
]);

export interface ExtractPlayerSnapshotOptions {
  exportedAt?: Date;
  pageUrl?: string;
  locale?: string;
}

export function extractPlayerSnapshot(
  document: Document,
  options: ExtractPlayerSnapshotOptions = {}
): ExtractionResult {
  const exportedAt = options.exportedAt ?? new Date();
  const warnings: ExtractionWarning[] = [];
  const players = extractPlayers(document, warnings);

  const snapshot = {
    schemaVersion: PLAYER_SNAPSHOT_SCHEMA_VERSION,
    source: {
      type: "sokker-dom-export" as const,
      exportedAt: exportedAt.toISOString(),
      pageUrl: options.pageUrl ?? document.location?.href ?? null,
      locale: options.locale ?? (document.documentElement.lang || navigator.language || null)
    },
    club: extractClub(document, options.pageUrl),
    snapshot: {
      snapshotDate: exportedAt.toISOString().slice(0, 10),
      season: findLabeledNumber(readElementText(document.body), ["season", "temporada"]),
      week: findLabeledNumber(readElementText(document.body), ["week", "semana"])
    },
    players
  };

  if (players.length === 0) {
    warnings.push({
      path: "players",
      message: "No player rows or player cards were detected on this page."
    });
  }

  return { snapshot, warnings };
}

function extractClub(document: Document, pageUrl?: string) {
  const explicitClub = textFromSelector(document, "[data-atlas-club-name], [data-club-name]");
  const headingClub = textFromSelector(document, ".club-name, #club-name, header h1, h1");
  const clubName = explicitClub || headingClub || document.title.split("|")[0]?.trim() || "Unknown club";
  const externalId = findIdInUrl(pageUrl ?? document.location?.href ?? "", ["team", "club"]);

  return {
    externalId,
    name: clubName
  };
}

function extractPlayers(document: Document, warnings: ExtractionWarning[]): PlayerExport[] {
  const explicitCards = [...document.querySelectorAll<HTMLElement>("[data-atlas-player]")];

  if (explicitCards.length > 0) {
    return explicitCards.map((card, index) => playerFromCard(card, index, warnings)).filter(isPlayer);
  }

  const tablePlayers = extractPlayersFromTables(document, warnings);

  if (tablePlayers.length > 0) {
    return tablePlayers;
  }

  const likelyCards = [
    ...document.querySelectorAll<HTMLElement>(".player, .player-row, .player-card, [class*='player']")
  ].filter((element) => element.querySelector("a") || findAnyNumber(element.innerText));

  return likelyCards.map((card, index) => playerFromCard(card, index, warnings)).filter(isPlayer);
}

function extractPlayersFromTables(document: Document, warnings: ExtractionWarning[]): PlayerExport[] {
  const players: PlayerExport[] = [];

  document.querySelectorAll("table").forEach((table) => {
    const headers = [...table.querySelectorAll("thead th, thead td, tr:first-child th")].map((header) =>
      normalizeLabel(readElementText(header))
    );

    if (!headers.some((header) => matchesAny(header, fieldLabels.name))) {
      return;
    }

    const rows = [...table.querySelectorAll("tbody tr")];
    const dataRows = rows.length > 0 ? rows : [...table.querySelectorAll("tr")].slice(1);

    dataRows.forEach((row) => {
      const player = playerFromTableRow(row, headers, players.length, warnings);

      if (player) {
        players.push(player);
      }
    });
  });

  return players;
}

function playerFromTableRow(
  row: Element,
  headers: string[],
  index: number,
  warnings: ExtractionWarning[]
): PlayerExport | null {
  const cells = [...row.querySelectorAll("td, th")];
  const textByHeader = new Map<string, string>();

  headers.forEach((header, cellIndex) => {
    textByHeader.set(header, normalizeWhitespace(cells[cellIndex] ? readElementText(cells[cellIndex]!) : ""));
  });

  const nameCell = cellFor(row, headers, fieldLabels.name);
  const name = normalizeWhitespace(nameCell ? readElementText(nameCell) : valueFor(textByHeader, fieldLabels.name));
  const age = parseFirstNumber(valueFor(textByHeader, fieldLabels.age));
  const wage = parseMoney(valueFor(textByHeader, fieldLabels.wage));
  const estimatedValue = parseMoney(valueFor(textByHeader, fieldLabels.estimatedValue));
  const skills = parseSkillsFromTable(textByHeader);

  if (!name || age === null || wage.amount === null || estimatedValue.amount === null) {
    return null;
  }

  collectPlayerWarnings(index, skills, warnings);

  return {
    externalId: findPlayerId(nameCell ?? row),
    name,
    age,
    wage: { amount: wage.amount, currency: wage.currency },
    estimatedValue: { amount: estimatedValue.amount, currency: estimatedValue.currency },
    form: parseFirstNumber(valueFor(textByHeader, fieldLabels.form)),
    availabilityStatus: parseAvailability(valueFor(textByHeader, fieldLabels.availabilityStatus) || readElementText(row)),
    observedPosition: nullable(valueFor(textByHeader, fieldLabels.observedPosition)),
    skills
  };
}

function playerFromCard(
  card: HTMLElement,
  index: number,
  warnings: ExtractionWarning[]
): PlayerExport | null {
  const text = readElementText(card);
  const name =
    card.dataset.atlasName ||
    textFromSelector(card, "[data-atlas-player-name], .player-name, .name, h2, h3, a") ||
    "";
  const age = parseFirstNumber(card.dataset.atlasAge || findValueAfterLabel(text, fieldLabels.age));
  const wage = parseMoney(card.dataset.atlasWage || findValueAfterLabel(text, fieldLabels.wage));
  const estimatedValue = parseMoney(
    card.dataset.atlasEstimatedValue || card.dataset.atlasValue || findValueAfterLabel(text, fieldLabels.estimatedValue)
  );
  const skills = parseSkillsFromCard(card, text);

  if (!name || age === null || wage.amount === null || estimatedValue.amount === null) {
    return null;
  }

  collectPlayerWarnings(index, skills, warnings);

  return {
    externalId: card.dataset.atlasExternalId || findPlayerId(card),
    name,
    age,
    wage: { amount: wage.amount, currency: wage.currency },
    estimatedValue: { amount: estimatedValue.amount, currency: estimatedValue.currency },
    form: parseFirstNumber(card.dataset.atlasForm || findValueAfterLabel(text, fieldLabels.form)),
    availabilityStatus: parseAvailability(
      card.dataset.atlasAvailabilityStatus || findValueAfterLabel(text, fieldLabels.availabilityStatus) || text
    ),
    observedPosition: nullable(
      card.dataset.atlasObservedPosition || card.dataset.atlasPosition || findValueAfterLabel(text, fieldLabels.observedPosition)
    ),
    skills
  };
}

function parseSkillsFromTable(textByHeader: Map<string, string>): Record<SkillKey, number | null> {
  return Object.fromEntries(
    skillKeys.map((skill) => {
      const rawValue = valueFor(textByHeader, skillLabels[skill]);
      const labeledValue = findValueAfterLabel(rawValue, skillLabels[skill]);

      return [skill, parseSkillValue(labeledValue || rawValue)];
    })
  ) as Record<SkillKey, number | null>;
}

function parseSkillsFromCard(card: HTMLElement, text: string): Record<SkillKey, number | null> {
  return Object.fromEntries(
    skillKeys.map((skill) => {
      const dataValue = card.dataset[`atlasSkill${toPascalCase(skill)}`];
      const selectorValue = textFromSelector(card, `[data-atlas-skill="${skill}"]`);
      const labelValue = findValueAfterLabel(text, skillLabels[skill]);

      return [skill, parseSkillValue(dataValue || selectorValue || labelValue)];
    })
  ) as Record<SkillKey, number | null>;
}

function collectPlayerWarnings(
  index: number,
  skills: Record<SkillKey, number | null>,
  warnings: ExtractionWarning[]
) {
  skillKeys.forEach((skill) => {
    if (skills[skill] === null) {
      warnings.push({
        path: `players.${index}.skills.${skill}`,
        message: `Could not read ${skill} from the visible DOM.`
      });
    }
  });
}

function parseMoney(value: string | undefined): { amount: number | null; currency: string | null } {
  if (!value) {
    return { amount: null, currency: null };
  }

  const currency =
    value.match(/\b(ARS|USD|EUR|GBP|PLN|BRL|MXN)\b/i)?.[1]?.toUpperCase() ??
    currencyFromSymbol(value);
  const numeric = value.replace(/[^\d,.-]/g, "");
  const amount = applyMoneyMultiplier(parseLocalizedNumber(numeric), value);

  return { amount, currency };
}

function parseSkillValue(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const numeric = parseFirstNumber(value);

  if (numeric !== null) {
    return numeric;
  }

  return textualSkillValues.get(normalizeLabel(value)) ?? null;
}

function parseFirstNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/\d+(?:[.,]\d+)?/);

  return match ? Number(match[0].replace(",", ".")) : null;
}

function parseLocalizedNumber(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");
  const separators = [...trimmed.matchAll(/[,.]/g)].map((match) => match.index ?? -1);
  const lastSeparator = Math.max(lastComma, lastDot);
  const digitsAfterLastSeparator = lastSeparator >= 0 ? trimmed.length - lastSeparator - 1 : 0;

  if (separators.length > 1 || digitsAfterLastSeparator === 3) {
    const parsedInteger = Number(trimmed.replace(/[^\d-]/g, ""));

    return Number.isFinite(parsedInteger) ? parsedInteger : null;
  }

  const decimalSeparator = lastComma > lastDot ? "," : ".";
  const withoutThousands = trimmed
    .replace(decimalSeparator === "," ? /\./g : /,/g, "")
    .replace(decimalSeparator, ".");
  const parsed = Number(withoutThousands.replace(/[^\d.-]/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function parseAvailability(value: string): PlayerExport["availabilityStatus"] {
  const normalized = normalizeLabel(value);

  if (/\binjur|lesion|contus|wound/.test(normalized)) {
    return "injured";
  }

  if (/\bsuspend|sancion|cards?\b|tarjeta/.test(normalized)) {
    return "suspended";
  }

  if (/\bavailable|disponible|healthy|ok\b/.test(normalized)) {
    return "available";
  }

  return "unknown";
}

function findValueAfterLabel(text: string, labels: string[]): string {
  const normalizedLines = text
    .split(/\n|;/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  for (const line of normalizedLines) {
    const normalized = normalizeLabel(line);
    const label = labels.find((candidate) => normalized.startsWith(`${normalizeLabel(candidate)} `));

    if (label) {
      return line.slice(label.length).replace(/^[:\s-]+/, "").trim();
    }

    for (const candidate of labels) {
      const expression = new RegExp(`${escapeRegExp(normalizeLabel(candidate))}\\s*[:\\-]?\\s*([^;|\\n]+)`);
      const match = normalized.match(expression);

      if (match?.[1]) {
        return match[1].trim();
      }
    }
  }

  return "";
}

function findLabeledNumber(text: string, labels: string[]): number | null {
  const directValue = parseFirstNumber(findValueAfterLabel(text, labels));

  if (directValue !== null) {
    return directValue;
  }

  const normalized = normalizeLabel(text);

  for (const label of labels) {
    const match = normalized.match(new RegExp(`${normalizeLabel(label)}\\s*(\\d+)`));

    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  return null;
}

function findPlayerId(element: Element): string | null {
  const explicit = element.getAttribute("data-atlas-external-id") || element.getAttribute("data-player-id");

  if (explicit) {
    return explicit;
  }

  const href = element.querySelector("a")?.getAttribute("href") ?? "";

  return findIdInUrl(href, ["player", "playerID"]);
}

function findIdInUrl(url: string, markers: string[]): string | null {
  for (const marker of markers) {
    const match = url.match(new RegExp(`${marker}(?:/PID|ID)?[=/](\\d+)|${marker}/(\\d+)`, "i"));

    if (match?.[1] || match?.[2]) {
      return match[1] ?? match[2] ?? null;
    }
  }

  return null;
}

function cellFor(row: Element, headers: string[], labels: string[]): Element | null {
  const index = headers.findIndex((header) => matchesAny(header, labels));

  return index >= 0 ? row.querySelectorAll("td, th")[index] ?? null : null;
}

function valueFor(values: Map<string, string>, labels: string[]): string {
  for (const [header, value] of values.entries()) {
    if (matchesAny(header, labels)) {
      return value;
    }
  }

  return "";
}

function textFromSelector(root: ParentNode, selector: string): string {
  const element = root.querySelector(selector);

  return element ? normalizeWhitespace(readElementText(element)) : "";
}

function matchesAny(value: string, labels: string[]): boolean {
  return labels.some((label) => value === normalizeLabel(label) || value.includes(normalizeLabel(label)));
}

function normalizeLabel(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function readElementText(element: Element): string {
  const parts = [
    element.textContent ?? "",
    element.getAttribute("title") ?? "",
    element.getAttribute("aria-label") ?? "",
    ...[...element.querySelectorAll("img[alt], [title], [aria-label]")].flatMap((child) => [
      child.getAttribute("alt") ?? "",
      child.getAttribute("title") ?? "",
      child.getAttribute("aria-label") ?? ""
    ])
  ];

  return normalizeWhitespace(parts.filter(Boolean).join(" "));
}

function nullable(value: string | undefined): string | null {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function findAnyNumber(value: string): boolean {
  return /\d/.test(value);
}

function isPlayer(player: PlayerExport | null): player is PlayerExport {
  return player !== null;
}

function toPascalCase(value: string): string {
  return value[0]!.toUpperCase() + value.slice(1);
}

function applyMoneyMultiplier(amount: number | null, rawValue: string): number | null {
  if (amount === null) {
    return null;
  }

  const normalized = normalizeLabel(rawValue);

  if (/(^|[\s\d.,])(k|mil|thousand)\b/.test(normalized)) {
    return Math.round(amount * 1000);
  }

  if (/(^|[\s\d.,])(m|millon|millones|million|mln)\b/.test(normalized)) {
    return Math.round(amount * 1000000);
  }

  return amount;
}

function currencyFromSymbol(value: string): string | null {
  if (value.includes("€")) {
    return "EUR";
  }

  if (value.includes("£")) {
    return "GBP";
  }

  if (value.includes("zł")) {
    return "PLN";
  }

  if (value.includes("R$")) {
    return "BRL";
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
