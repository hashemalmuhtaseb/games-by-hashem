import { route, z } from "@/lib/api";
import { db } from "@/lib/db";
import { PROVIDERS } from "@/content/pipeline/providers";
import { startGenerationJob } from "@/server/content-jobs";
import { trackEvent } from "@/server/progress";

export const GET = route({ name: "admin-content", staff: true, limit: [60, 2] }, async () => {
  const jobs = await db.contentGenerationJob.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  return {
    providers: PROVIDERS.map((p) => ({ id: p.id, label: p.label, verified: p.verified, topics: p.topics, unavailable: p.unavailableReason() })),
    jobs,
  };
});

const Start = z.object({
  provider: z.string().max(40),
  topic: z.string().trim().min(2).max(60),
  count: z.number().int().min(1).max(25),
  difficulty: z.number().int().min(1).max(5),
  autoPublish: z.boolean().default(false),
});

export const POST = route({ name: "admin-content-start", staff: true, schema: Start, limit: [6, 0.05] }, async ({ id, body }) => {
  const jobId = await startGenerationJob(body);
  await trackEvent("admin_action", id.player.id, null, { action: "generate", provider: body.provider, count: body.count, by: id.user?.username });
  return { ok: true, jobId };
});
