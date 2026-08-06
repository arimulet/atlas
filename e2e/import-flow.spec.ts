import { expect, test } from "@playwright/test";
import path from "node:path";

const fixturesDir = path.resolve("packages/test-fixtures/fixtures/player-snapshot");

test("imports a valid JSON snapshot and shows summary plus diagnostic", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Club dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No active club yet" })).toBeVisible();

  await page.getByTestId("snapshot-file-input").setInputFiles(path.join(fixturesDir, "valid.json"));

  await expect(page.getByText("Snapshot imported successfully.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "River Plate Forever" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Effective reading" })).toBeVisible();
  await expect(page.getByText("observed").first()).toBeVisible();
  await expect(page.getByText("manual").first()).toBeVisible();
  await expect(page.getByText("effective").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Historical availability" })).toBeVisible();
  await expect(page.getByText("Needs history")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Economia de plantilla" })).toBeVisible();
  await expect(page.getByText("Disponible desde salarios y valores observados.")).toBeVisible();
  await page.getByRole("button", { name: "Abrir Economia de plantilla" }).click();
  await expect(page.getByRole("heading", { name: "Lectura derivada de plantilla" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resumen economico observado" })).toBeVisible();
  await expect(page.getByText("Masa salarial", { exact: true })).toBeVisible();
  await expect(page.getByText("Valor estimado total")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hallazgos explicables" })).toBeVisible();
  await page.getByRole("button", { name: "Volver al dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Squad summary" })).toBeVisible();
  await expect(page.getByText("River Plate Forever").first()).toBeVisible();
  await expect(page.getByText("2026-08-05").first()).toBeVisible();
  await expect(page.getByText("ARS 450,000")).toBeVisible();
  await expect(page.getByText("ARS 12,000")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Basic findings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Squad Balance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evidence" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assumptions" }).first()).toBeVisible();
});

test("imports a JSON snapshot with warnings and keeps diagnostic visible", async ({ page }) => {
  await page.goto("/");

  await page
    .getByTestId("snapshot-file-input")
    .setInputFiles(path.join(fixturesDir, "accepted-with-warnings.json"));

  await expect(page.getByText("Snapshot imported with warnings.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Warnings" })).toBeVisible();
  await expect(page.getByText("players.0.externalId")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Squad summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Basic findings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Follow Up" })).toBeVisible();
});

test("shows blocking errors for an invalid JSON snapshot", async ({ page }) => {
  await page.goto("/");

  await page
    .getByTestId("snapshot-file-input")
    .setInputFiles(path.join(fixturesDir, "invalid.json"));

  await expect(page.getByText("Import rejected.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Blocking errors" })).toBeVisible();
  await expect(page.getByText("players.0.name")).toBeVisible();
  await expect(page.getByText("players.0.skills")).toBeVisible();
});
