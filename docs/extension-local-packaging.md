# Local Extension Packaging

## Scope

This document covers Extension Sprint 3: building, validating, packaging and manually installing the ATLAS browser extension for local use.

The extension remains a manual and transparent export tool. It reads visible Sokker DOM data only after the user opens the popup and requests a preview. It does not automate Sokker actions, does not navigate, does not log in, does not send data to external servers and does not sync directly with ATLAS.

## Build And Package

From the repository root:

```bash
npm run extension:build
npm run extension:package
```

Outputs:

- `apps/extension/dist`: reproducible Vite build output.
- `artifacts/extension/atlas-snapshot-exporter`: clean unpacked extension folder for local browser installation.

Validation can be run separately:

```bash
npm run extension:validate
```

The package validation allows only the extension runtime files:

- `manifest.json`
- `background.js`
- `content.js`
- `popup.html`
- `popup.js`
- `popup.css`

The package must not contain source files, tests, fixtures, `node_modules`, environment files, private data, secrets or heavy development dependencies.

## Local Installation

Use Chrome, Edge or another Chromium-based browser that supports unpacked Manifest V3 extensions.

1. Open the browser extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. Enable developer mode.
3. Choose `Load unpacked`.
4. Select `artifacts/extension/atlas-snapshot-exporter`.
5. Verify that `ATLAS Snapshot Exporter` appears as an active extension.

If the browser reports an error, run `npm run extension:package` again and reload the unpacked extension from the same folder.

## Basic Usage

1. Open a compatible Sokker squad page where player data is visible.
2. Open the ATLAS extension popup.
3. Click `Generate preview`.
4. Review the club, snapshot date, player count, warnings, player table and JSON preview.
5. Click `Download JSON`.
6. Open ATLAS.
7. Import the downloaded JSON through the player snapshot import flow.
8. Confirm that ATLAS accepts the import and shows the imported squad diagnosis.

Do not use the extension to automate Sokker. The user remains in control of every step.

## Manual Verification Checklist

- [ ] `npm run extension:build` completes successfully.
- [ ] `npm run extension:validate` accepts `apps/extension/dist`.
- [ ] `npm run extension:package` creates `artifacts/extension/atlas-snapshot-exporter`.
- [ ] The package folder contains only `manifest.json`, `background.js`, `content.js`, `popup.html`, `popup.js` and `popup.css`.
- [ ] The package folder does not contain `.env` files, secrets, source files, fixtures, tests, `node_modules` or development dependencies.
- [ ] The browser loads `artifacts/extension/atlas-snapshot-exporter` as an unpacked extension.
- [ ] `ATLAS Snapshot Exporter` appears active in the browser extensions page.
- [ ] On a compatible Sokker squad page, clicking `Generate preview` shows player data and warnings if any fields are missing.
- [ ] Clicking `Download JSON` downloads an `atlas-player-snapshot-*.json` file.
- [ ] The downloaded JSON validates as `atlas.player-snapshot.v0`.
- [ ] ATLAS imports the downloaded JSON successfully.
- [ ] The imported snapshot appears in ATLAS with players and diagnosis output.

## Import Compatibility

Automated tests cover the import path for JSON generated from representative Sokker DOM fixtures:

```bash
npm test -- --run apps/extension/__tests__/domParser.test.ts packages/application/__tests__/importPlayerSnapshot.test.ts
```

For final manual acceptance, use a JSON downloaded from the locally installed extension and import that exact file into ATLAS.
