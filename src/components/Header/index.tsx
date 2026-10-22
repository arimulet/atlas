import { useId } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/context/AuthContext";
import { useClub } from "@/context/ClubContext";
import type { HeaderProps } from "./types";

export function Header({ onOpenSokkerImporter }: HeaderProps) {
  const { user, logout } = useAuth();
  const { club } = useClub();
  const crestId = useId();
  const bgGradId = `crest-bg-${crestId.replace(/:/g, "")}`;
  const accentGradId = `crest-accent-${crestId.replace(/:/g, "")}`;

  return (
    <header className="atlas-header">
      <div className="atlas-header__brand-group">
        <BrandLogo />

        {user && club && (
          <>
            <span className="atlas-header__divider" aria-hidden="true" />
            <div
              className="atlas-team-badge"
              title={`${club.name} (#${club.clubId})`}
              aria-label={`Equipo: ${club.name}`}
            >
              <svg
                className="atlas-team-badge__logo"
                viewBox="0 0 28 32"
                width="24"
                height="28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                focusable="false"
              >
                <defs>
                  <linearGradient
                    id={bgGradId}
                    x1="0"
                    y1="0"
                    x2="28"
                    y2="32"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#1e2930" />
                    <stop offset="1" stopColor="#10171b" />
                  </linearGradient>
                  <linearGradient
                    id={accentGradId}
                    x1="0"
                    y1="0"
                    x2="28"
                    y2="32"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#55d39a" />
                    <stop offset="1" stopColor="#1f7a55" />
                  </linearGradient>
                </defs>
                <path
                  d="M14 1.5L3 5.5V15.5C3 23 8 28.5 14 30.5C20 28.5 25 23 25 15.5V5.5L14 1.5Z"
                  fill={`url(#${bgGradId})`}
                  stroke="var(--atlas-border)"
                  strokeWidth="1.2"
                />
                <path
                  d="M14 3.8L5 7.2V15.5C5 21.8 9.2 26.6 14 28.4C18.8 26.6 23 21.8 23 15.5V7.2L14 3.8Z"
                  stroke={`url(#${accentGradId})`}
                  strokeWidth="1"
                  strokeOpacity="0.75"
                />
                <path
                  d="M5 14.5L18.5 26.8C20.2 25.5 21.6 23.8 22.4 21.5L6.5 7.5C5.8 9.5 5.2 12 5 14.5Z"
                  fill={`url(#${accentGradId})`}
                  fillOpacity="0.25"
                />
                <path
                  d="M14 8.5L15.6 12.8L20 13.1L16.6 15.9L17.7 20.2L14 17.8L10.3 20.2L11.4 15.9L8 13.1L12.4 12.8L14 8.5Z"
                  fill={`url(#${accentGradId})`}
                />
              </svg>
              <span className="atlas-team-badge__name">{club.name}</span>
            </div>
          </>
        )}
      </div>

      <div className="atlas-header__tools">
        <button type="button" className="atlas-import-button" onClick={onOpenSokkerImporter}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M20 11a8 8 0 0 0-14.7-4.3L4 8" />
            <path d="M4 4v4h4" />
            <path d="M4 13a8 8 0 0 0 14.7 4.3L20 16" />
            <path d="M20 20v-4h-4" />
          </svg>
          <span>Update</span>
        </button>

        {user && (
          <div className="atlas-user-menu">
            <span className="atlas-user-email" title={user.email ?? ""}>
              {user.email}
            </span>
            <button
              type="button"
              className="atlas-logout-button"
              onClick={() => void logout()}
              title="Sign Out"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
