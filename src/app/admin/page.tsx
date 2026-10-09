import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { identify, isStaff } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage() {
  const jar = await cookies();
  const id = await identify(Object.fromEntries(jar.getAll().map((c) => [c.name, c.value])), false);
  // Non-staff get the ordinary 404 page: the dashboard is not advertised and its code is never sent.
  if (!id || !isStaff(id.user)) notFound();
  return <AdminDashboard role={id.user!.role} username={id.user!.username} />;
}
