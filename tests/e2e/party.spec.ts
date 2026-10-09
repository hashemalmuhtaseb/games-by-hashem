import { expect, test, type Browser, type Page } from "@playwright/test";

async function player(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext();
  return ctx.newPage();
}

test("two players play a live room: lobby, question, reveal, chat, results", async ({ browser }) => {
  const host = await player(browser);
  await host.goto("/party");
  await host.getByText("Quickfire").first().click();
  await host.waitForURL(/\/room\/[A-Z0-9]+/);
  const code = host.url().split("/room/")[1];

  const guest = await player(browser);
  await guest.goto(`/room/${code}`);
  // Both players appear in the host's lobby.
  await expect(host.locator("text=/2\\s*\\/\\s*\\d+/").first()).toBeVisible({ timeout: 15_000 });

  await host.getByText(/▶ Start/).click();
  for (const p of [host, guest]) await expect(p.locator("button.min-h-16").first()).toBeVisible({ timeout: 15_000 });
  for (const p of [host, guest]) await p.locator("button.min-h-16").first().click();
  for (const p of [host, guest]) await expect(p.getByText("Answer", { exact: true }).first()).toBeVisible({ timeout: 15_000 });

  // The built-in Game Master hosts by default.
  await expect(host.getByText("Game Master").first()).toBeVisible();

  const msg = `gg ${Date.now() % 1000}`;
  await guest.locator("input[placeholder='Message…']").first().fill(msg);
  await guest.locator("input[placeholder='Message…']").first().press("Enter");
  await expect(host.getByText(msg).first()).toBeVisible();

  host.on("dialog", (d) => d.accept());
  await host.getByText("End game").click();
  await expect(guest.getByText(/Winner|tie/i).first()).toBeVisible({ timeout: 15_000 });
});
