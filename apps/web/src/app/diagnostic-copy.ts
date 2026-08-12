import type {
  CurrencySettings,
  DiagnosticAssumption,
  DiagnosticFinding,
  DiagnosticParameterValue,
  DiagnosticParameters,
  DiagnosticRecommendation,
  DiagnosticTrace
} from "./types";

const roleLabels: Record<string, string> = {
  goalkeeper: "arquero",
  defender: "defensor",
  midfielder: "mediocampista",
  winger: "extremo",
  striker: "delantero"
};

const fieldLabels: Record<string, string> = {
  playerId: "identificador del jugador",
  form: "forma",
  availabilityStatus: "disponibilidad",
  observedPosition: "posici\u00f3n observada"
};

const monetaryTraceCodes = new Set(["player.wage", "player.estimated-value", "squad.median-wage"]);

export function describeDiagnosticFinding(
  finding: DiagnosticFinding,
  currency?: CurrencySettings | null
): string {
  const parameters = finding.parameters ?? {};

  if (finding.code.startsWith("squad-balance.") && finding.code.endsWith(".deficit")) {
    return (
      "La plantilla tiene " +
      number(parameters.currentCount) +
      " jugador(es) en " +
      roleLabel(parameters.role) +
      "; el m\u00ednimo de referencia es " +
      number(parameters.minimum) +
      "."
    );
  }

  switch (finding.code) {
    case "economic-risk.high-wage-low-value-ratio":
      return (
        stringValue(parameters.playerName) +
        " tiene un salario alto (" +
        money(parameters.wage, currency) +
        ") en relaci\u00f3n con su valor estimado (" +
        money(parameters.value, currency) +
        ")."
      );
    case "asset-risk.senior-high-value":
      return (
        stringValue(parameters.playerName) +
        " combina una edad senior con un valor estimado relevante (" +
        money(parameters.value, currency) +
        ")."
      );
    case "training-potential.young-role-fit":
      return stringValue(parameters.playerName) + " es joven y muestra un buen ajuste para su rol.";
    case "follow-up.incomplete-player-data":
      return (
        stringValue(parameters.playerName) +
        " requiere seguimiento porque sus datos importados est\u00e1n incompletos."
      );
    default:
      return finding.code;
  }
}

export function describeDiagnosticTrace(
  trace: DiagnosticTrace,
  currency?: CurrencySettings | null
): string {
  const parameters = trace.parameters ?? {};
  const playerName = stringValue(parameters.playerName);
  let label: string;

  switch (trace.code) {
    case "player.observed-position":
      label = playerName + ": posici\u00f3n observada";
      break;
    case "player.role-score":
      label = playerName + ": puntuaci\u00f3n de " + roleLabel(parameters.role);
      break;
    case "player.best-role-score":
      label = playerName + ": mejor puntuaci\u00f3n de rol";
      break;
    case "squad.role.count":
      label = "Jugadores " + roleLabel(parameters.role);
      break;
    case "squad.role.baseline":
      label = "M\u00ednimo de " + roleLabel(parameters.role);
      break;
    case "player.wage":
      label = "Salario de " + playerName;
      break;
    case "player.estimated-value":
      label = "Valor estimado de " + playerName;
      break;
    case "squad.median-wage":
      label = "Salario medio de la plantilla";
      break;
    case "player.value-to-wage-ratio":
      label = "Relaci\u00f3n valor/salario de " + playerName;
      break;
    case "player.age":
      label = "Edad de " + playerName;
      break;
    case "player.role":
      label = "Rol de " + playerName;
      break;
    case "player.missing-field":
      label =
        playerName +
        ": falta " +
        (fieldLabels[stringValue(parameters.field)] ?? stringValue(parameters.field));
      break;
    default:
      label = trace.code;
  }

  if (trace.value === null) {
    return label;
  }

  const value = monetaryTraceCodes.has(trace.code)
    ? money(trace.value, currency)
    : number(trace.value);
  return label + ": " + value;
}

export function describeDiagnosticAssumption(
  assumption: DiagnosticAssumption,
  currency?: CurrencySettings | null
): string {
  const parameters = assumption.parameters ?? {};

  switch (assumption.code) {
    case "role-from-skills":
      return "La posici\u00f3n se infiere a partir de las habilidades visibles porque no fue observada directamente.";
    case "role-baseline":
      return (
        "La plantilla se compara contra un m\u00ednimo inicial de " +
        number(parameters.minimum) +
        " " +
        roleLabel(parameters.role) +
        "."
      );
    case "economic-threshold":
      return (
        "El riesgo salarial comienza en el mayor valor entre " +
        money(parameters.minimumWage, currency) +
        " y 1,5 veces el salario medio de la plantilla."
      );
    case "value-to-wage-threshold":
      return (
        "Una relaci\u00f3n valor/salario inferior a " +
        number(parameters.maximumRatio) +
        " se considera ineficiente."
      );
    case "asset-age-threshold":
      return (
        "Los jugadores de " +
        number(parameters.minimumAge) +
        " a\u00f1os o m\u00e1s se revisan como activos de riesgo."
      );
    case "asset-value-threshold":
      return (
        "Un valor estimado de " +
        money(parameters.minimumValue, currency) +
        " o m\u00e1s se considera relevante."
      );
    case "training-age-threshold":
      return (
        "Los jugadores de hasta " +
        number(parameters.maximumAge) +
        " a\u00f1os se consideran entrenables."
      );
    case "training-role-score-threshold":
      return (
        "Una puntuaci\u00f3n de rol de " +
        number(parameters.minimumScore) +
        " o m\u00e1s indica potencial inicial de entrenamiento."
      );
    case "incomplete-data-confidence":
      return "Los datos observados faltantes reducen la confianza del diagn\u00f3stico.";
    case "missing-player-id":
      return "La identidad del jugador no debe fusionarse autom\u00e1ticamente sin playerId o revisi\u00f3n manual.";
    default:
      return assumption.code;
  }
}

export function describeDiagnosticRecommendation(
  recommendation: DiagnosticRecommendation,
  currency?: CurrencySettings | null
): string {
  const parameters = recommendation.parameters ?? {};
  const playerName = stringValue(parameters.playerName);

  switch (recommendation.code) {
    case "review-role-depth":
      return (
        "Revisar la profundidad de " +
        roleLabel(parameters.role) +
        " antes de tomar decisiones sobre la plantilla."
      );
    case "review-wage-burden":
      return (
        "Revisar la carga salarial de " +
        playerName +
        ": salario " +
        money(parameters.wage, currency) +
        " frente a valor estimado " +
        money(parameters.value, currency) +
        "."
      );
    case "track-player-value-evolution":
      return (
        "Seguir la evoluci\u00f3n del valor de " +
        playerName +
        ", actualmente " +
        money(parameters.value, currency) +
        ", antes de postergar una decisi\u00f3n de mercado."
      );
    case "review-player-training":
      return "Considerar a " + playerName + " para una revisi\u00f3n de entrenamiento focalizado.";
    case "review-player-source-data":
      return (
        "Revisar los datos de origen de " +
        playerName +
        " antes de confiar en comparaciones hist\u00f3ricas."
      );
    default:
      return recommendation.code;
  }
}

function roleLabel(value: DiagnosticParameterValue | undefined): string {
  return roleLabels[stringValue(value)] ?? stringValue(value);
}

function stringValue(value: DiagnosticParameterValue | undefined): string {
  return value === null || value === undefined ? "dato no disponible" : String(value);
}

function number(value: DiagnosticParameterValue | undefined): string {
  return typeof value === "number" ? value.toLocaleString("es-AR") : stringValue(value);
}

function money(
  value: DiagnosticParameterValue | undefined,
  currency?: CurrencySettings | null
): string {
  if (typeof value !== "number") {
    return stringValue(value);
  }

  if (!currency || currency.rate <= 0) {
    return number(value);
  }

  return currency.name + " " + Math.round(value / currency.rate).toLocaleString("es-AR");
}
