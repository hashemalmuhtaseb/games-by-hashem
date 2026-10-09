import { RoomClient } from "@/components/room/RoomClient";

export const metadata = { title: "Party room" };

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomClient code={code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5)} />;
}
