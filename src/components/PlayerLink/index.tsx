import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { pathForPlayerDetail } from "@/app/routing";
import { CountryNameFlag } from "@/components/CountryNameFlag";
import {
  registerPlayerCountry,
  usePlayerCountry
} from "@/context/PlayerCountryContext";

export interface PlayerLinkCards {
  yellow?: number;
  red?: number;
}

export interface PlayerLinkInjury {
  days?: number | null;
  severe?: boolean | null;
}

export interface PlayerLinkProps {
  children: ReactNode;
  countryName?: string | null;
  playerId: string;
  onSelectPlayer: (playerId: string) => void;
  className?: string;
  title?: string;
  showExternalLink?: boolean;
  cards?: PlayerLinkCards | null;
  injury?: PlayerLinkInjury | null;
}

export interface PlayerStatusBadgesProps {
  cards?: PlayerLinkCards | null;
  injury?: PlayerLinkInjury | null;
  alwaysReserveSpace?: boolean;
}

export function PlayerStatusBadges({
  cards,
  injury,
  alwaysReserveSpace = false
}: PlayerStatusBadgesProps) {
  const hasInjury = typeof injury?.days === "number" && injury.days > 0;
  const isSevere = hasInjury && injury.severe === true;
  const yellowCount = cards?.yellow ?? 0;
  const redCount = cards?.red ?? 0;
  const hasYellow = yellowCount > 0;
  const hasRed = redCount > 0;
  const hasCards = hasYellow || hasRed;

  if (!hasInjury && !hasCards && !alwaysReserveSpace) {
    return null;
  }

  return (
    <span
      className={`atlas-player-status-badges${!hasInjury && !hasCards ? " is-empty" : ""}`}
      aria-label="Estado del jugador"
    >
      <span className="atlas-player-status-slot is-injury">
        {hasInjury ? (
          <span
            className={`atlas-injury-badge ${isSevere ? "is-severe" : "is-bruised"}`}
            title={
              isSevere
                ? `Lesionado (grave): ${injury.days} día${injury.days! > 1 ? "s" : ""} restante${injury.days! > 1 ? "s" : ""}`
                : `Lastimado (con venda): ${injury.days} día${injury.days! > 1 ? "s" : ""} restante${injury.days! > 1 ? "s" : ""}`
            }
            aria-label={
              isSevere
                ? `Lesionado grave: ${injury.days} días restantes`
                : `Lastimado con venda: ${injury.days} días restantes`
            }
          >
            {isSevere ? "✚" : "🩹"}
          </span>
        ) : null}
      </span>
      <span className="atlas-player-status-slot is-cards">
        {hasYellow ? (
          <span
            className="atlas-card-group"
            title={`${yellowCount} tarjeta${yellowCount > 1 ? "s" : ""} amarilla${yellowCount > 1 ? "s" : ""}`}
            aria-label={`${yellowCount} tarjeta${yellowCount > 1 ? "s" : ""} amarilla${yellowCount > 1 ? "s" : ""}`}
          >
            {Array.from({ length: Math.min(yellowCount, 3) }).map((_, i) => (
              <span key={i} className="atlas-card-badge is-yellow" />
            ))}
          </span>
        ) : null}
        {hasRed ? (
          <span
            className="atlas-card-badge is-red"
            title={redCount > 1 ? `${redCount} tarjetas rojas (Suspendido)` : "Tarjeta roja (Suspendido)"}
            aria-label={redCount > 1 ? `${redCount} tarjetas rojas (Suspendido)` : "Tarjeta roja (Suspendido)"}
          />
        ) : null}
      </span>
    </span>
  );
}

export function PlayerLink({
  children,
  countryName,
  onSelectPlayer,
  playerId,
  className,
  title,
  showExternalLink = true,
  cards,
  injury,
  alwaysReserveStatusSpace
}: PlayerLinkProps & { alwaysReserveStatusSpace?: boolean }) {
  if (countryName) {
    registerPlayerCountry(playerId, countryName);
  }

  const contextCountry = usePlayerCountry(playerId);
  const resolvedCountry = countryName ?? contextCountry;
  const externalUrl = `https://sokker.org/player/PID/${playerId}`;
  const shouldReserveSpace =
    alwaysReserveStatusSpace ?? (cards !== undefined || injury !== undefined);

  return (
    <span className="atlas-player-link-group">
      <Link
        className={`atlas-player-link${className ? ` ${className}` : ""}`}
        href={pathForPlayerDetail(playerId)}
        title={title}
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          ) {
            return;
          }

          event.preventDefault();
          onSelectPlayer(playerId);
        }}
      >
        <PlayerStatusBadges
          cards={cards}
          injury={injury}
          alwaysReserveSpace={shouldReserveSpace}
        />
        <span className="atlas-player-flag-slot">
          {resolvedCountry ? <CountryNameFlag countryName={resolvedCountry} /> : null}
        </span>
        <span className="atlas-player-link__name">{children}</span>
      </Link>
      {showExternalLink ? (
        <a
          className="atlas-player-link__external"
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Ver en Sokker.org"
          aria-label="Ver en Sokker.org"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={12} />
        </a>
      ) : null}
    </span>
  );
}
