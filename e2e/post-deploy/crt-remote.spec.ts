import { expect, test } from "@playwright/test";

test("CRT shell plays one look turn against remote game API", async ({ page }) => {
  await page.goto("/");

  const statusStrip = page.locator("#status-strip");
  await expect(statusStrip).not.toContainText("Connecting", { timeout: 30_000 });
  await expect(statusStrip).toContainText(/Fortran|connected/i, {
    timeout: 30_000,
  });

  const transcript = page.locator("#crt-transcript");
  await expect(transcript).not.toHaveText("", { timeout: 60_000 });

  const input = page.locator("#command-input");
  await expect(input).toBeEnabled({ timeout: 60_000 });

  const before = (await transcript.textContent()) ?? "";
  await input.fill("look");
  await input.press("Enter");

  await expect
    .poll(async () => (await transcript.textContent()) ?? "", {
      timeout: 90_000,
    })
    .not.toBe(before);

  const after = (await transcript.textContent()) ?? "";
  expect(after.length).toBeGreaterThan(before.length);
  expect(after.toLowerCase()).toMatch(/look|room|cave|hall|you are/i);
});
