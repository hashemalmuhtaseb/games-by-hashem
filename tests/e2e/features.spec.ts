import { expect, test, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";

/**
 * End-to-end checks for profile pictures, Risk & Reward, Rare Words recognition, poker,
 * the medicine games and closest-answer scoring. Set SCREEN_DIR to also save screenshots.
 */

const shot = async (page: Page, name: string) => {
  if (process.env.SCREEN_DIR) await page.screenshot({ path: `${process.env.SCREEN_DIR}/${name}.png`, fullPage: true });
};

async function newPlayer(browser: Browser, mobile = false): Promise<Page> {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {});
  const page = await ctx.newPage();
  await page.goto("/");
  return page;
}

async function pngBuffer(color: string): Promise<Buffer> {
  return sharp({ create: { width: 400, height: 300, channels: 3, background: color } }).png().toBuffer();
}

test.describe("profile pictures", () => {
  test("upload, crop, save, refresh, show everywhere; bad files and other players are refused", async ({ browser }) => {
    const page = await newPlayer(browser);
    await page.goto("/profile");
    await page.getByRole("button", { name: /Edit profile/ }).click();
    await page.getByRole("button", { name: /Upload a photo/ }).click();
    // Wrong format is rejected in the browser before upload.
    await page.getByTestId("avatar-file").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByText("Use a JPG, PNG or WebP image.")).toBeVisible();
    await page.getByTestId("avatar-file").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: await pngBuffer("#3366ff") });
    await expect(page.getByLabel(/Crop preview/)).toBeVisible();
    await page.getByRole("slider", { name: "Zoom" }).fill("1.5");
    await shot(page, "avatar-crop");
    await page.getByRole("button", { name: "Save photo" }).click();
    await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();

    const me = await (await page.request.get("/api/me")).json();
    expect(me.me.photo).toMatch(/^\/api\/avatar\/[a-z0-9]+\?v=1$/);
    // Served as a re-encoded square WebP with long-lived caching for this version.
    const img = await page.request.get(me.me.photo);
    expect(img.status()).toBe(200);
    expect(img.headers()["content-type"]).toBe("image/webp");
    expect(img.headers()["cache-control"]).toContain("immutable");
    const meta = await sharp(await img.body()).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 256, 256]);

    // Persists across a reload and shows in the navigation bar and the profile.
    await page.reload();
    await expect(page.locator(`img[src="${me.me.photo}"]`).first()).toBeVisible();
    await shot(page, "profile-with-photo");

    // Uploading again bumps the version so every cache sees the new picture.
    await page.getByRole("button", { name: /Edit profile/ }).click();
    await page.getByRole("button", { name: "Change photo" }).click();
    await page.getByTestId("avatar-file").setInputFiles({ name: "me2.png", mimeType: "image/png", buffer: await pngBuffer("#ff6633") });
    await page.getByRole("button", { name: "Save photo" }).click();
    await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();
    const me2 = await (await page.request.get("/api/me")).json();
    expect(me2.me.photo).toMatch(/\?v=2$/);

    // A file that only pretends to be a PNG is refused by the server.
    const fake = await page.request.post("/api/me/avatar", { multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("GIF89a not really an image") } } });
    expect(fake.status()).toBe(400);
    expect((await fake.json()).error).toMatch(/JPG, PNG or WebP/);

    // Another player can only ever change their own picture: there is no way to name someone else.
    const other = await newPlayer(browser);
    const before = await (await other.request.get("/api/me")).json();
    await other.request.post("/api/me/avatar", { multipart: { file: { name: "o.png", mimeType: "image/png", buffer: await pngBuffer("#00aa00") } } });
    const after = await (await page.request.get("/api/me")).json();
    expect(after.me.photo).toBe(me2.me.photo);
    expect(before.me.id).not.toBe(after.me.id);

    // The picture appears to other players in a live room lobby.
    await page.goto("/party");
    await page.getByText("Quickfire").first().click();
    await page.waitForURL(/\/room\/[A-Z0-9]+/);
    const code = page.url().split("/room/")[1];
    await other.goto(`/room/${code}`);
    await expect(other.locator(`img[src="${me2.me.photo}"]`).first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Risk & Reward", () => {
  test("shows the balance, payout and loss, confirms the stake and settles it", async ({ browser }) => {
    const page = await newPlayer(browser);
    await page.goto("/play/risk-reward");
    await expect(page.getByText("Balance").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("1,000").first()).toBeVisible();
    const stake = page.locator("input[inputmode=numeric]").first();
    await stake.fill("5000");
    await expect(page.getByText("You only have 1,000 chips.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Review stake" })).toBeDisabled();
    await stake.fill("200");
    await expect(page.getByText("−200").first()).toBeVisible();
    await page.getByRole("button", { name: "Review stake" }).click();
    await shot(page, "risk-confirm");
    await page.getByRole("button", { name: "Confirm stake" }).click();
    await expect(page.getByText("Stake locked: 200 chips")).toBeVisible();
    await page.locator("button.min-h-16").first().click();
    await expect(page.getByText("Answer", { exact: true })).toBeVisible();
    // Balance is now 1,200 or 800 (even odds) or more at better odds: never anything else.
    const header = await page.locator("header").innerText();
    const bal = Number(header.match(/([\d,]+)\s*chips/i)![1].replace(/,/g, ""));
    expect(bal === 800 || bal > 1000).toBe(true);
    await shot(page, "risk-reveal");
  });
});

test.describe("Rare Words", () => {
  test("recognises Marcos Rojo from a typo and shows a reason for nonsense", async ({ browser }) => {
    const page = await newPlayer(browser);
    // Drive the API directly until we get the football round for M (or no letter).
    let view: { round: { roundId: string; prompt: string; input?: { letter?: string } } } | null = null;
    let sessionId = "";
    for (let i = 0; i < 40 && !view; i++) {
      const r = await (await page.request.post("/api/play/start", { data: { game: "rare-words", modes: ["footballers"] } })).json();
      const l = r.view.round.input?.letter;
      if (!l || l === "M") {
        view = r.view;
        sessionId = r.sessionId;
      }
    }
    expect(view).not.toBeNull();
    const res = await (await page.request.post("/api/play/act", { data: { sessionId, roundId: view!.round.roundId, action: { type: "answer", value: "Marcus Rojo" } } })).json();
    expect(res.feedback).toMatchObject({ valid: true, canonical: "Marcos Rojo", corrected: "Marcus Rojo" });
    expect(res.points).toBeGreaterThan(20);

    await page.goto("/play/rare-words?modes=footballers");
    const input = page.locator("input.input").first();
    await expect(input).toBeVisible({ timeout: 20_000 });
    await input.fill("Zzyzx Qwertyuiop");
    await input.press("Enter");
    await expect(page.getByText(/couldn.t find a football player/)).toBeVisible();
    await expect(page.getByRole("button", { name: /report it/ })).toBeVisible();
    await shot(page, "rare-rejected");
  });
});

test.describe("Poker", () => {
  test("solo table deals, keeps opponents' cards hidden, and accepts actions", async ({ browser }) => {
    const page = await newPlayer(browser);
    const states: string[] = [];
    page.on("websocket", (ws) => ws.on("framereceived", (f) => typeof f.payload === "string" && f.payload.includes("poker:state") && states.push(f.payload)));
    await page.goto("/poker");
    await page.getByRole("button", { name: "Play" }).click();
    await page.waitForURL(/\/poker\/P[A-Z0-9]{4}/);
    await expect(page.getByRole("button", { name: "Deal" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Deal" }).click();
    await expect(page.getByText(/Pre-flop|Flop|Turn|River|Showdown/).first()).toBeVisible({ timeout: 15_000 });
    // My two cards are face up; opponents' are face down.
    await expect(page.getByRole("img", { name: /of (spades|hearts|diamonds|clubs)/ }).first()).toBeVisible();
    await expect(page.getByRole("img", { name: "Face-down card" }).first()).toBeVisible();
    await shot(page, "poker-table");
    // Play a few actions whenever it's our turn.
    for (let i = 0; i < 6; i++) {
      const fold = page.getByRole("button", { name: "Fold" });
      if (await fold.isVisible().catch(() => false)) {
        const check = page.getByRole("button", { name: "Check" });
        if (await check.isVisible().catch(() => false)) await check.click();
        else await page.getByRole("button", { name: /^Call|^All-in \d/ }).first().click();
      }
      await page.waitForTimeout(1500);
    }
    // No state message ever carried another player's hole cards before showdown.
    for (const raw of states) {
      const [, data] = JSON.parse(raw.replace(/^\d+/, ""));
      const view = data.view;
      if (view.hand?.street === "showdown") continue;
      for (const s of view.seats) if (s && s.id !== data.you) expect(s.hole).toBeNull();
    }
    expect(states.length).toBeGreaterThan(0);
  });
});

test.describe("Medicine games", () => {
  test("Diagnose the Patient shows a case, a hint costs points, and the reveal explains", async ({ browser }) => {
    const page = await newPlayer(browser);
    await page.goto("/play/diagnose?modes=beginner");
    await expect(page.getByText("Presenting complaint")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/not medical advice/).first()).toBeVisible();
    await page.getByRole("button", { name: /Show a hint/ }).click();
    await expect(page.getByText(/^Hint:/)).toBeVisible();
    await shot(page, "diagnose-case");
    await page.locator("button.min-h-16").first().click();
    await expect(page.getByText("Answer", { exact: true })).toBeVisible();
    await expect(page.getByText(/Teaching point:/)).toBeVisible();
  });

  test("Medical Mystery charges for clues and diagnoses", async ({ browser }) => {
    const page = await newPlayer(browser, true);
    await page.goto("/play/medical-mystery");
    await expect(page.getByText("Points left if you're right now")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("100", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Symptoms/ }).click();
    await expect(page.getByText("90", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Examination/ }).click();
    await expect(page.getByText("75", { exact: true })).toBeVisible();
    await shot(page, "mystery-mobile");
    await page.locator("button.min-h-16").first().click();
    await expect(page.locator("button.min-h-16").first()).toBeVisible();
  });
});

test.describe("Closest wins", () => {
  test("two players guess; the reveal shows each guess, distance and the closest player", async ({ browser }) => {
    const host = await newPlayer(browser);
    await host.goto("/games/guess-the-year");
    await host.getByRole("button", { name: /Host a room/ }).click();
    await host.waitForURL(/\/room\/[A-Z0-9]+/);
    const code = host.url().split("/room/")[1];
    const guest = await newPlayer(browser);
    await guest.goto(`/room/${code}`);
    await expect(host.locator("text=/2\\s*\\/\\s*\\d+/").first()).toBeVisible({ timeout: 15_000 });
    await host.getByText(/▶ Start/).click();
    const lockIn = (p: Page) => p.getByRole("button", { name: "Lock in" });
    for (const p of [host, guest]) await expect(lockIn(p)).toBeVisible({ timeout: 20_000 });
    // Different guesses: one slider position each.
    await host.locator("input.input[inputmode=numeric]").fill("1990");
    await guest.locator("input.input[inputmode=numeric]").fill("2000");
    for (const p of [host, guest]) await lockIn(p).click();
    await expect(host.getByText(/Closest guess wins the round/)).toBeVisible({ timeout: 20_000 });
    await expect(host.getByText(/Guessed 1990 · off by/)).toBeVisible();
    await expect(host.getByText(/off by/).first()).toBeVisible();
    await expect(host.getByTitle("Closest guess").first()).toBeVisible();
    await shot(host, "closest-reveal");
  });
});
