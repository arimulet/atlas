import { pathForPlayerDetail } from "../../routing";

interface PlayerLinkProps {
  children: string;
  playerId: string;
  onSelectPlayer: (playerId: string) => void;
}

export function PlayerLink({ children, onSelectPlayer, playerId }: PlayerLinkProps) {
  return (
    <a
      className="atlas-player-link"
      href={pathForPlayerDetail(playerId)}
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
      {children}
    </a>
  );
}
