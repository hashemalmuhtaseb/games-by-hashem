import { notFound } from "next/navigation";
import { catalog } from "@/server/catalog";
import { SoloPlay } from "@/components/play/SoloPlay";

export const dynamic = "force-dynamic";

export default async function PlayPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ variant?: string; modes?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const g = catalog().find((x) => x.slug === slug && !x.href);
  if (!g) notFound();
  const variant = (["classic", "survival", "ranked", "chaos", "daily"].includes(sp.variant ?? "") ? sp.variant : "classic") as "classic";
  const modes = sp.modes?.split(",").filter((m) => g.modes.some((x) => x.id === m));
  return <SoloPlay game={{ slug: g.slug, name: g.name, icon: g.icon, accent: g.accent }} variant={variant} modes={modes} />;
}
