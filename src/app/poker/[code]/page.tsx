import { PokerTable } from "@/components/poker/PokerTable";

export const metadata = { title: "Poker table" };

export default async function PokerTablePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PokerTable code={code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5)} />;
}
