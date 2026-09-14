import { expect, test } from "@playwright/test";

test("muestra la pantalla de acceso", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
});
