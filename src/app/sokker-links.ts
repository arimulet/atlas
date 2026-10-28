export function sokkerPlayerUrl(playerId: string): string {
  return `https://app.sokker.org/player/${encodeURIComponent(playerId)}`;
}
