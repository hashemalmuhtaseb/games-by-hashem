import { SoloPlay } from "@/components/play/SoloPlay";

export const metadata = { title: "Daily Challenge" };

export default function DailyPage() {
  return <SoloPlay game={{ slug: "roulette", name: "Daily Challenge", icon: "📅", accent: ["#f59e0b", "#ec4899"], group: "party" }} variant="daily" />;
}
