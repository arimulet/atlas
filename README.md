# ATLAS

ATLAS is a long-term football management intelligence platform for Sokker. It helps a Sporting Director import observable club data, preserve historical snapshots and produce explainable diagnosis for human decision-making.

ATLAS does not automate actions in Sokker, does not play the game and does not replace the user decision.

## Repository

This repository contains only the software implementation:

- `apps/web`: React + Vite web application.
- `apps/api`: Node.js + Fastify API.
- `apps/extension`: Manifest V3 browser extension for manual Sokker DOM export.
- `packages/contracts`: Zod JSON contracts and import validation.
- `packages/domain`: minimal domain types.
- `packages/application`: use-case boundary for application logic.
- `packages/database`: MongoDB + Mongoose models.
- `packages/test-fixtures`: valid and invalid JSON fixtures.

Project strategy, product decisions and architecture knowledge live in `atlas-workspace`.

## Commands

```bash
npm install
npm test
npm run build
npm run dev:web
npm run dev:api
npm run dev:extension
```

## Browser Extension

Build the unpacked extension with:

```bash
npm run build -w @atlas/extension
```

Then load `apps/extension/dist` in the browser extension development screen. The popup only reads the active Sokker page after the user clicks `Generate preview`; it shows the JSON preview before downloading and does not automate Sokker clicks, navigation, login, or network sync.

## Technical Baseline

- npm workspaces
- TypeScript
- React + Vite
- Fastify
- MongoDB + Mongoose
- Zod
- Vitest
- Playwright reserved for future critical UI flows only
