"use client";

import { useState, useEffect } from "react";
import type { StadiumStand, StandLocation, StandType } from "@/domain/stadium/types";
import { STAND_LOCATION_INFO, STAND_TYPE_LABELS } from "@/domain/stadium/types";
import { X, Layers, Users } from "lucide-react";

interface StadiumSectorEditorProps {
  stand: StadiumStand;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (location: StandLocation, updates: Partial<StadiumStand>) => void;
}

export function StadiumSectorEditor({
  stand,
  isOpen,
  onClose,
  onUpdate
}: StadiumSectorEditorProps) {
  // Local draft state: changes are only committed when clicking "Listo"
  const [draft, setDraft] = useState<StadiumStand>({ ...stand });

  useEffect(() => {
    setDraft({ ...stand });
  }, [stand]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const info = STAND_LOCATION_INFO[stand.location];

  const handleCapacityStep = (delta: number) => {
    setDraft((prev) => ({
      ...prev,
      size: Math.max(0, Math.min(100000, prev.size + delta))
    }));
  };

  const handleCapacityInput = (valueStr: string) => {
    const parsed = parseInt(valueStr, 10);
    const newSize = isNaN(parsed) ? 0 : Math.max(0, Math.min(100000, parsed));
    setDraft((prev) => ({ ...prev, size: newSize }));
  };

  const handleTypeChange = (type: StandType) => {
    setDraft((prev) => ({ ...prev, type }));
  };

  const handleRoofToggle = () => {
    setDraft((prev) => ({ ...prev, roof: !prev.roof }));
  };

  const handleApply = () => {
    onUpdate(stand.location, {
      size: draft.size,
      type: draft.type,
      roof: draft.roof
    });
    onClose();
  };

  const standTypes: StandType[] = [1, 2, 3];

  return (
    <div className="atlas-sector-editor-overlay" onClick={onClose}>
      <div className="atlas-sector-editor" onClick={(e) => e.stopPropagation()}>
        {/* Editor Header */}
        <div className="atlas-sector-editor__header">
          <div className="atlas-sector-editor__title">
            <span className="atlas-sector-editor__code">{info.code}</span>
            <div>
              <h3>{info.label}</h3>
              <p>Personalizar capacidad, asientos y cubierta</p>
            </div>
          </div>

          <button
            type="button"
            className="atlas-sector-editor__close"
            onClick={onClose}
            aria-label="Cerrar editor sin guardar"
            title="Cancelar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Editor Body */}
        <div className="atlas-sector-editor__body">
          {/* 1. Capacidad */}
          <div className="atlas-sector-editor__group">
            <label className="atlas-sector-editor__label">
              <Users size={16} />
              <span>Capacidad de Espectadores</span>
            </label>

            <div className="atlas-sector-editor__stepper">
              <button
                type="button"
                className="step-btn"
                onClick={() => handleCapacityStep(-1000)}
                title="Restar 1.000 lugares"
              >
                -1.000
              </button>
              <button
                type="button"
                className="step-btn"
                onClick={() => handleCapacityStep(-500)}
                title="Restar 500 lugares"
              >
                -500
              </button>

              <div className="input-wrap">
                <input
                  type="number"
                  min={0}
                  max={100000}
                  step={100}
                  value={draft.size}
                  onChange={(e) => handleCapacityInput(e.target.value)}
                  className="capacity-input"
                />
                <span className="unit-label">lugares</span>
              </div>

              <button
                type="button"
                className="step-btn"
                onClick={() => handleCapacityStep(500)}
                title="Sumar 500 lugares"
              >
                +500
              </button>
              <button
                type="button"
                className="step-btn"
                onClick={() => handleCapacityStep(1000)}
                title="Sumar 1.000 lugares"
              >
                +1.000
              </button>
            </div>

            {/* Slider de ajuste rápido */}
            <input
              type="range"
              min={0}
              max={50000}
              step={100}
              value={draft.size}
              onChange={(e) => handleCapacityInput(e.target.value)}
              className="capacity-slider"
            />
          </div>

          {/* 2. Tipo de Asiento */}
          <div className="atlas-sector-editor__group">
            <label className="atlas-sector-editor__label">
              <span>Tipo de Grada / Asiento</span>
            </label>

            <div className="atlas-sector-editor__type-pills">
              {standTypes.map((type) => {
                const isActive = draft.type === type;
                return (
                  <button
                    key={type}
                    type="button"
                    className={`type-pill ${isActive ? "type-pill--active" : ""}`}
                    onClick={() => handleTypeChange(type)}
                  >
                    <span className="pill-dot" data-type={type} />
                    <span>{STAND_TYPE_LABELS[type]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Techado */}
          <div className="atlas-sector-editor__group">
            <label className="atlas-sector-editor__label">
              <Layers size={16} />
              <span>Cubierta / Techo</span>
            </label>

            <label className="atlas-sector-editor__checkbox-card">
              <input
                type="checkbox"
                checked={draft.roof}
                onChange={handleRoofToggle}
              />
              <div className="checkbox-info">
                <strong>Sector techado con cubierta</strong>
                <span>Instala la estructura voladiza superior con pilares metálicos</span>
              </div>
            </label>
          </div>
        </div>

        {/* Editor Footer */}
        <div className="atlas-sector-editor__footer">
          <button
            type="button"
            className="atlas-sector-editor__cancel-btn"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="atlas-sector-editor__done-btn"
            onClick={handleApply}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
