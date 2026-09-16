import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { pathForPlayerDetail } from "@/app/routing";
import { CountryNameFlag } from "@/components/CountryNameFlag";
import {
  registerPlayerCountry,
  usePlayerCountry
} from "@/context/PlayerCountryContext";

export interface PlayerLinkProps {
  children: ReactNode;
  countryName?: string | null;
  playerId: string;
  onSelectPlayer: (playerId: string) => void;
  className?: string;
  title?: string;
  showExternalLink?: boolean;
}

export function PlayerLink({
  children,
  countryName,
  onSelectPlayer,
  playerId,
  className,
  title,
  showExternalLink = true
}: PlayerLinkProps) {
  if (countryName) {
    registerPlayerCountry(playerId, countryName);
  }

  const contextCountry = usePlayerCountry(playerId);
  const resolvedCountry = countryName ?? contextCountry;
  const externalUrl = `https://sokker.org/player/PID/${playerId}`;

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
        {resolvedCountry ? <CountryNameFlag countryName={resolvedCountry} /> : null}
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
