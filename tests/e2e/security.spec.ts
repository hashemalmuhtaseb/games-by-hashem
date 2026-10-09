import { expect, test } from "@playwright/test";

test("the admin dashboard is invisible to guests", async ({ page, request }) => {
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
  for (const path of ["/api/admin/overview", "/api/admin/questions", "/api/admin/users", "/api/admin/content"]) {
    const r = await request.get(path);
    expect(r.status(), path).toBe(404);
  }
  const r = await request.patch("/api/admin/users", { data: { userId: "x", role: "ADMIN" } });
  expect(r.status()).toBe(404);
});

test("public endpoints never expose emails or password hashes", async ({ request }) => {
  const games = await request.get("/api/games");
  expect(games.ok()).toBeTruthy();
  const lb = await (await request.get("/api/leaderboard?board=xp")).text();
  expect(lb).not.toMatch(/passwordHash|email/);
});
