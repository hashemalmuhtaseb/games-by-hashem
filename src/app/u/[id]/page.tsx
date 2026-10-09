import { notFound } from "next/navigation";
import { publicProfile } from "@/server/profiles";
import { ProfileView } from "@/components/ProfileView";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) notFound();
  const p = await publicProfile(id);
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <ProfileView p={p} />
    </div>
  );
}
