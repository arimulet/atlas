import { useEffect, useState } from "react";

import { SokkerImporterForm } from "../SokkerImporterForm";
import type { SokkerImportModalProps } from "./types";

export function SokkerImportModal({ isOpen, onClose, onImport }: SokkerImportModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="atlas-v2-sokker-modal" role="presentation">
      <div className="atlas-v2-sokker-modal__overlay" aria-hidden="true" />
      <section
        className="atlas-v2-sokker-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="atlas-v2-sokker-modal-title"
        aria-describedby="atlas-v2-sokker-modal-description"
      >
        <div className="atlas-v2-sokker-modal__header">
          <div>
            <p className="atlas-v2-sokker-modal__eyebrow">Importador Sokker</p>
            <h2 id="atlas-v2-sokker-modal-title">Actualizar datos de Sokker</h2>
          </div>
          <button
            type="button"
            className="atlas-v2-sokker-modal__close"
            aria-label="Cerrar"
            onClick={onClose}
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        <p id="atlas-v2-sokker-modal-description" className="atlas-v2-sokker-modal__description">
          Ingresá tus credenciales de Sokker para actualizar los datos de ATLAS.
        </p>

        <SokkerImporterForm onCancel={onClose} onImport={onImport} onLoadingChange={setIsLoading} />
      </section>
    </div>
  );
}
