import { expect, test } from "@playwright/test";

test("home page lists the game library", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Guess the Flag").first()).toBeVisible();
  await expect(page.getByText("Word Forge").first()).toBeVisible();
  await page.getByText("Guess the Flag").first().click();
  await expect(page).toHaveURL(/\/games\/flags/);
  await expect(page.getByRole("button", { name: /Play solo/ })).toBeVisible();
});

test("a solo flags round plays through to the reveal without leaking the answer", async ({ page }) => {
  const bodies: string[] = [];
  page.on("response", async (r) => {
    if (/\/api\/play\/(start|next)/.test(r.url())) bodies.push(await r.text());
  });
  await page.goto("/play/flags?modes=classic");
  const options = page.locator("button.min-h-16");
  await expect(options.first()).toBeVisible();
  await options.first().click();
  await expect(page.getByText("Answer", { exact: true })).toBeVisible();
  const answer = (await page.locator("text=Answer >> xpath=following-sibling::*[1]").first().innerText()).trim();
  expect(answer.length).toBeGreaterThan(1);
  // The answer was only revealed after answering: the question payload never contained the correct option id marker.
  for (const b of bodies) expect(b).not.toMatch(/"(correctOptionId|accept|answerLabel)"/);
  await page.getByText("Next →").click();
  await expect(page.getByText(/round 2 \//i)).toBeVisible();
});

test("Word Forge lets you fix a typo without losing a try", async ({ page }) => {
  await page.goto("/play/word-forge");
  const input = page.locator("input.input").first();
  await expect(input).toBeVisible();
  await input.fill("zzzzzz");
  await page.getByRole("button", { name: "Forge" }).click();
  await expect(page.getByText("uses letters you don't have")).toBeVisible();
  await expect(input).toBeEnabled();
});

test("football clue answers are focused and suggest player names as you type", async ({ page }) => {
  await page.goto("/play/football?modes=legend");
  const input = page.locator("input.input").first();
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  await page.keyboard.type("me");
  const options = page.getByRole("option");
  await expect(options.first()).toBeVisible();
  await expect(page.getByRole("option", { name: "Lionel Messi" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await expect(input).not.toBeFocused();
  await page.keyboard.type("x");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("mex");
});
