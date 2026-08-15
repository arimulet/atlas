import { pathForPlayerDetail } from "../../routing";

interface V2PlayerLinkProps {
  children: string;
  playerId: string;
  onSelectPlayer: (playerId: string) => void;
}

export function V2PlayerLink({ children, onSelectPlayer, playerId }: V2PlayerLinkProps) {
  return (
    <a
      className="v2-player-link"
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
