import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/context/AuthContext";
import type { HeaderProps } from "./types";

export function Header({ onOpenSokkerImporter }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="atlas-header">
      <BrandLogo />

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
