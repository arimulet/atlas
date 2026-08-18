import { FormEvent, useState } from "react";

import type { ImportResponse } from "@atlas/web/app/types";
import type { SokkerImporterFormProps } from "./types";

type Feedback = { kind: "error" | "success"; message: string; details?: string[] } | null;

function getSuccessFeedback(result: ImportResponse): NonNullable<Feedback> {
  if (result.importResult.status === "accepted-with-warnings") {
    return {
      kind: "success",
      message: "Datos actualizados con advertencias.",
      details: result.importResult.warnings.map((warning) => warning.message)
    };
  }

  return { kind: "success", message: "Datos actualizados correctamente." };
}

export function SokkerImporterForm({
  onCancel,
  onImport,
  onLoadingChange
}: SokkerImporterFormProps) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const canSubmit = login.trim().length > 0 && password.length > 0 && !isLoading;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setFeedback(null);
    setIsLoading(true);
    onLoadingChange?.(true);

    try {
      const result = await onImport({ login: login.trim(), password });
      setFeedback(getSuccessFeedback(result));
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "No se pudieron actualizar los datos."
      });
    } finally {
      setIsLoading(false);
      onLoadingChange?.(false);
    }
  };

  return (
    <form className="atlas-sokker-importer" onSubmit={handleSubmit}>
      <div className="atlas-sokker-importer__fields">
        <div className="atlas-sokker-importer__field">
          <label htmlFor="atlas-sokker-login">Usuario</label>
          <input
            id="atlas-sokker-login"
            type="text"
            name="login"
            autoComplete="username"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <div className="atlas-sokker-importer__field">
          <label htmlFor="atlas-sokker-password">Contraseña</label>
          <input
            id="atlas-sokker-password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isLoading}
            required
          />
        </div>
      </div>

      {feedback ? (
        <div
          className={`atlas-sokker-importer__feedback is-${feedback.kind}`}
          role={feedback.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          <span aria-hidden="true">{feedback.kind === "error" ? "⚠" : "✓"}</span>
          <div>
            <p>{feedback.message}</p>
            {feedback.details?.length ? (
              <ul>
                {feedback.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="atlas-sokker-importer__actions">
        <button
          type="button"
          className="atlas-button atlas-button--secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="atlas-button atlas-button--primary"
          disabled={!canSubmit}
        >
          {isLoading ? (
            <>
              <span className="atlas-spinner" aria-hidden="true" />
              Actualizando...
            </>
          ) : (
            "Actualizar"
          )}
        </button>
      </div>
    </form>
  );
}
