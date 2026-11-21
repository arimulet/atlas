"use client";

import { useState } from "react";
import type { StadiumData, StadiumStand, StandLocation } from "@/domain/stadium/types";
import { STAND_LOCATION_INFO, STAND_TYPE_LABELS } from "@/domain/stadium/types";
import { DEFAULT_SOKKER_STADIUM } from "@/domain/stadium/mockData";
import { StadiumCanvas3D } from "./StadiumCanvas3D";
import { StadiumSectorEditor } from "./StadiumSectorEditor";
import { Users, Maximize2, Edit3 } from "lucide-react";
import "./styles.scss";

interface StadiumProps {
  initialData?: StadiumData;
}

export function Stadium({ initialData = DEFAULT_SOKKER_STADIUM }: StadiumProps) {
  const [stadiumData, setStadiumData] = useState<StadiumData>(initialData);
  const [selectedStand, setSelectedStand] = useState<StandLocation | null>(null);
  const [editingLocation, setEditingLocation] = useState<StandLocation | null>(null);

  const totalSeats = stadiumData.stands.reduce((acc, s) => acc + s.size, 0);

  // Map stands by location for quick access in the 3x3 grid
  const standByLocation = new Map<StandLocation, StadiumStand>();
  stadiumData.stands.forEach((s) => standByLocation.set(s.location, s));

  const handleOpenEditor = (loc: StandLocation) => {
    setSelectedStand(loc);
    setEditingLocation(loc);
  };

  const handleCanvasSelectStand = (loc: StandLocation) => {
    // Only toggles highlight in 3D and in the 3x3 grid without opening the editor modal
    setSelectedStand((prev) => (prev === loc ? null : loc));
  };

  const handleResetStadium = () => {
    const base = initialData || DEFAULT_SOKKER_STADIUM;
    setStadiumData({
      ...base,
      stands: base.stands.map((s) => ({ ...s }))
    });
    setSelectedStand(null);
    setEditingLocation(null);
  };

  const handleUpdateStand = (location: StandLocation, updates: Partial<StadiumStand>) => {
    setStadiumData((prev) => {
      const newStands = prev.stands.map((s) => {
        if (s.location === location) {
          return { ...s, ...updates };
        }
        return s;
      });
      const newSeats = newStands.reduce((acc, s) => acc + s.size, 0);
      return {
        ...prev,
        seats: newSeats,
        stands: newStands
      };
    });
  };

  // 3x3 Grid layout definition matching Sokker:
  // Row 1: NW (5), N (1), NE (6)
  // Row 2: W (3), Center Pitch, E (4)
  // Row 3: SW (7), S (2), SE (8)
  const gridCells: Array<StandLocation | "pitch"> = [
    5, 1, 6,
    3, "pitch", 4,
    7, 2, 8
  ];

  const editingStand = editingLocation ? standByLocation.get(editingLocation) : null;

  const renderSectorCell = (loc: StandLocation) => {
    const stand = standByLocation.get(loc);
    if (!stand) return null;

    const info = STAND_LOCATION_INFO[loc];
    const isSelected = selectedStand === loc;

    return (
      <div
        key={loc}
        className={`atlas-stadium__sector-cell ${isSelected ? "atlas-stadium__sector-cell--selected" : ""}`}
        onClick={() => handleOpenEditor(loc)}
        title={`Clic para editar ${info.label}`}
      >
        <div className="atlas-stadium__sector-cell-header">
          <span className="sector-code">{info.code}</span>
          <div className="sector-badges">
            <span className="badge-type">{STAND_TYPE_LABELS[stand.type]}</span>
            {stand.roof && <span className="badge-roof">Techo</span>}
          </div>
        </div>

        <div className="atlas-stadium__sector-cell-body">
          <span className="sector-name">{info.label}</span>
          <span className="sector-capacity">{stand.size.toLocaleString("es-ES")}</span>
        </div>

        <div className="atlas-stadium__sector-cell-footer">
          <span className="ticket-label">Precio: {stand.ticketPrice ? `${stand.ticketPrice.value} ${stand.ticketPrice.currency}` : "-"}</span>
          <span className="ticket-val" style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
            <Edit3 size={13} /> Editar
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="atlas-stadium">
      {/* Encabezado Principal con el Nombre del Estadio */}
      <header className="atlas-stadium__header">
        <h1>{stadiumData.name}</h1>
      </header>

      {/* Top Row: Visor a la izquierda, Información a la derecha */}
      <div className="atlas-stadium__top-row">
        {/* Visor 3D a la izquierda */}
        <div className="atlas-stadium__viewer-card">
          <StadiumCanvas3D
            stadium={stadiumData}
            selectedLocation={selectedStand}
            onSelectStand={handleCanvasSelectStand}
            onReset={handleResetStadium}
          />
        </div>

        {/* Información a la derecha */}
        <aside className="atlas-stadium__info-card">
          <div className="atlas-stadium__info-card-header">
            <h3>Información</h3>
          </div>

          <div className="atlas-stadium__info-card-metrics">
            <div className="atlas-stadium__info-card-metric-box">
              <div className="metric-icon">
                <Maximize2 size={22} />
              </div>
              <div className="metric-text">
                <span>Dimensiones</span>
                <strong>{stadiumData.pitch.length} × {stadiumData.pitch.width} m</strong>
              </div>
            </div>

            <div className="atlas-stadium__info-card-metric-box">
              <div className="metric-icon">
                <Users size={22} />
              </div>
              <div className="metric-text">
                <span>Capacidad Total</span>
                <strong>{totalSeats.toLocaleString("es-ES")} lugares</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom Section: Formato de secciones de Sokker (Matriz 3x3) */}
      <section className="atlas-stadium__sectors-section">
        <div className="atlas-stadium__sectors-header">
          <h2>Sectores del estadio</h2>
          <span>
            {selectedStand
              ? `Sector seleccionado: ${STAND_LOCATION_INFO[selectedStand].label} (${STAND_LOCATION_INFO[selectedStand].code})`
              : "Haz clic en cualquier sector para editarlo y ver los cambios en 3D"}
          </span>
        </div>

        <div className="atlas-stadium__grid-3x3">
          {gridCells.map((item) => {
            if (item === "pitch") {
              return (
                <div key="center-pitch" className="atlas-stadium__pitch-center-cell">
                  <span className="pitch-title">Campo de Juego</span>
                  <span className="pitch-dims">{stadiumData.pitch.length} × {stadiumData.pitch.width} m</span>
                  <span className="pitch-total">{totalSeats.toLocaleString("es-ES")} espectadores</span>
                </div>
              );
            }
            return renderSectorCell(item);
          })}
        </div>
      </section>

      {/* Modal / Drawer para editar el sector */}
      {editingStand && (
        <StadiumSectorEditor
          stand={editingStand}
          isOpen={true}
          onClose={() => setEditingLocation(null)}
          onUpdate={handleUpdateStand}
        />
      )}
    </div>
  );
}
