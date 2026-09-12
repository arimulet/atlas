import type { ReactNode } from "react";
import Link from "next/link";
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
}

export function PlayerLink({
  children,
  countryName,
  onSelectPlayer,
  playerId,
  className,
  title
}: PlayerLinkProps) {
  if (countryName) {
    registerPlayerCountry(playerId, countryName);
  }

  const contextCountry = usePlayerCountry(playerId);
  const resolvedCountry = countryName ?? contextCountry;

  return (
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
  );
}
