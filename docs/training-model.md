# Training model

ATLAS models the weekly training report returned by Sokker's JSON API. For completed training,
`report.intensity` is the source of truth for received effectiveness; ATLAS does not reconstruct
intensity from matches or minutes and has no predictive minutes-to-intensity model.

The canonical weekly record contains the player, game week, season week, date, training `type`,
training `kind`, `intensity`, visible skills and `skillsChange`. `kind` maps `individual` to
`advanced`, `formation` to `formation`, and `missing` to `missing`. `missing` is a neutral state
and does not imply injury. `kind` describes the modality while `intensity` describes the amount
received; either can be zero independently.

`type` is mapped centrally and may be `general`, `stamina`, `keeper`, `playmaking`, `passing`,
`technique`, `defending`, `striker` or `pace`. The API-only `games` object is used only to parse
the external response and never reaches the canonical domain or persistence model.

`skillsChange` is the primary source for visible weekly skill ups and downs. Its `up` and `down`
aggregates are retained for validation. When needed, the visible previous level is reconstructed
as `skills[skill] - skillsChange[skill]`.

ATLAS no longer models matches, leagues, lineups, participation or played minutes as part of
training history.
