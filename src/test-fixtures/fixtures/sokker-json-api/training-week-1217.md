Captured read-only on 2026-11-14. Credentials and HTTP headers were never saved or logged.
Player profiles were replaced with a synthetic profile; Sokker player IDs and report facts remain.

- `latest`: `/api/training`, 25 reports: 11 formation, 10 individual, 4 missing.
- `explicit`: `/api/training?week=1217`, 24 reports: 12 formation, 10 individual, 2 missing.
- The explicit query recovers formation player `40378797`. The default query instead includes
  new roster players `40396901` and `40396902`, both with missing reports.
- Every entry has a singular `report` in this real capture. Array/plural variants are derived
  separately in tests, without claiming that they caused the original incident.
- The recovered player's report omits the eight training skills. `knownReportSkills` contains
  the existing, complete factual training record for that exact player and source week, read
  from ATLAS with a projection containing only IDs, week and skills. Without this evidence the
  importer rejects the redacted report; it never substitutes another week's skills.
- Summary for 1217: 12 formation, 10 advanced, 6 skill increases.
- The visible screen is week 9 (`currentCalendar.week=1218`). Both summary and reports label
  source week 1217 as season week 8, dated 2026-11-12. Diagnostics therefore associate the
  current visible week 9 with requested source week 1217, preserving the original season week 8.
  Changing the historical record to season week 9 would contradict the captured source.
- Previous parser accepts 11 formation reports from `latest`. The corrected import requests
  `explicit` and recovers same-week redacted skills, yielding 12 complete formation reports.

Files changed for this correction (paths relative to the repository):

- `src/application/importer/providers/api/SokkerJsonApiProvider.ts`
- `src/application/importer/providers/api/mappers.ts`
- `src/application/importer/providers/api/training-schema.ts` (new)
- `src/application/importer/providers/SokkerDataProvider.ts`
- `src/application/importer/sokker-sync-loader.ts`
- `src/application/importer/sokker-sync-validator.ts`
- `src/application/importer/sokker-sync-retry.ts` (new)
- `src/application/importer/types.d.ts`
- `src/application/importer/index.ts`
- `src/database/repositories/trainingWeekRepository.ts`
- `src/app/api/imports/sokker-sync/route.ts`
- `src/app/api/imports/sokker-sync/route.test.ts`
- `src/application/__tests__/sokker-sync-retry.test.ts` (new)
- `src/application/__tests__/sokker-sync-loader.test.ts`
- `src/application/__tests__/sokker-sync-validator.test.ts`
- `src/application/__tests__/sokker-sync-integration.test.ts`
- `src/test-fixtures/fixtures/sokker-json-api/training-week-1217.fixture.json` (new)
- This fixture provenance document (new).

Final verification: `npm test` passed all 751 tests in 75 files; `npm run lint` and
`npx tsc --noEmit --incremental false` passed. The real corrected provider was also checked
read-only against Sokker and existing same-week skills: 24 received, 24 accepted, 12 formation
against summary 12, no discards. No production records were written during investigation.
