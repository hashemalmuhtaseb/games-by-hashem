import { route } from "@/lib/api";
import { syncCatalogue } from "@/server/content-index";
import { trackEvent } from "@/server/progress";

export const POST = route({ name: "admin-sync", admin: true, limit: [3, 0.02] }, async ({ id }) => {
  const r = await syncCatalogue();
  await trackEvent("admin_action", id.player.id, null, { action: "sync", added: r.questionsAdded, by: id.user?.username });
  return r;
});
