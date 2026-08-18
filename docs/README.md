# ATLAS Technical Docs

This folder is reserved for technical documentation required to run, test or maintain the software.

Product strategy, roadmap, domain decisions and project state belong in `atlas-workspace`.

## Estado técnico actual

- ATLAS tiene una única UI canónica; no existe versionado de UI ni selector entre interfaces.
- Las nuevas sincronizaciones utilizan exclusivamente Sokker JSON API.
- El antiguo provider XML fue eliminado.
- Los snapshots y demás datos históricos conservan su provenance y siguen siendo válidos.
