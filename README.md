# ATLAS

ATLAS is a long-term football management intelligence platform for Sokker. It helps a Sporting Director import observable club data, preserve historical snapshots and produce explainable diagnosis for human decision-making.

ATLAS does not automate actions in Sokker, does not play the game and does not replace the user decision.

## Repository Structure

This repository contains the full Next.js application structured with clean architecture layers:

- `src/app`: Next.js App Router (UI pages, layouts, and `/api` route handlers).
- `src/domain`: Pure domain logic, calculations, and entities.
- `src/application`: Application use cases, orchestrators, and Sokker sync loaders.
- `src/database`: MongoDB connection, Mongoose models, and repositories.
- `src/utils`: Shared utilities and helpers.
- `src/test-fixtures`: Deterministic fixtures for importer tests.

Project strategy, product decisions and architecture knowledge live in `atlas-workspace`.

## Commands

```bash
npm install
npm run dev      # Start Next.js development server
npm run build    # Build Next.js application for production
npm test         # Run unit and integration tests with Vitest
npm run lint     # Lint source code with ESLint
```

## Data Import

The official data import flow uses the Sokker JSON API through the ATLAS web application. Users authenticate with their Sokker credentials to synchronize current data while preserving historical snapshots.

## Technical Baseline

- Next.js (App Router)
- TypeScript
- MongoDB + Mongoose
- Zod
- Vitest
- Playwright reserved for critical UI flows
