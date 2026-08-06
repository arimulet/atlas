# Extension Compatibility Notes

## Scope

Sprint 2 validates the manual browser extension against representative Sokker squad HTML fixtures.

The extension still only reads the visible DOM after the user clicks the popup action. It does not automate Sokker clicks, navigation, login, form submission, or network synchronization with ATLAS.

## Representative DOM Assumptions

- Squad pages may render players as `.player-box__center` / `.player-box` cards containing `.player-box__content`.
- Player identity is read first from links matching `/player/PID/<id>` or `/app/player/<id>`.
- Club name is read from explicit data attributes, common club-name selectors, page headings, or the document title fallback.
- Snapshot date is read from explicit snapshot-date selectors, `time[datetime]`, or visible labeled text when present; otherwise export date is used.
- Season and week are read from visible labels such as `Temporada 78 Semana 7`.
- Age, salary and estimated value are read from player header fields.
- Visible position or role is read from player header position/role selectors when present.
- Availability is read from visible status text or status icon metadata; injury and suspension markers map to `injured` and `suspended`.
- Skills are read from `.skill-list__item` rows using visible labels and numeric or textual values.

## Normalization Assumptions

- `u$s` and `US$` map to `USD`.
- `$` maps to `ARS` for the initial Spanish/Argentina-oriented fixtures.
- Explicit currency codes such as `ARS`, `USD`, `EUR`, `GBP`, `PLN`, `BRL`, and `MXN` are preferred when visible.
- Thousand separators with spaces, dots, or commas are normalized to plain numbers.
- Compact money suffixes such as `k`, `mil`, `m`, `million`, and `mln` are expanded.
- Spanish Sokker skill words are mapped to the same numeric scale used by the initial contract, from `tragico = 0` to `superdivino = 18`.

## Known Limits

- DOM class names are not guaranteed by Sokker and may require selector updates.
- If the page does not expose a stable player id, ATLAS imports the player with identity warnings.
- If position is not visible, ATLAS may derive a role from skills during import.
- Currency is only trusted when a supported code or known symbol is visible; otherwise it remains nullable.
