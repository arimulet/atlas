import { expect, test } from "@playwright/test";

test("opens the canonical ATLAS UI and navigates its main modules", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "ATLAS modules" })).toBeVisible();

  for (const module of ["Squad", "Training", "Youth", "Finances", "Diagnostics"]) {
    await page.getByRole("link", { name: module, exact: true }).click();
    await expect(page.getByRole("heading", { name: module, exact: true })).toBeVisible();
  }
});

test("opens the Sokker synchronization form without exposing implementation details", async ({
  page
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Actualizar" }).click();

  await expect(page.getByRole("heading", { name: "Actualizar datos de Sokker" })).toBeVisible();
  await expect(page.getByLabel("Usuario")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);
});
