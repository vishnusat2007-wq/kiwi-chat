import { Messenger } from "@/components/messenger";
import { requirePageSession } from "@/lib/page-auth";
import { ensurePersistence, getBootstrap } from "@/lib/store";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ChatPage() {
  const viewerId = await requirePageSession();
  await ensurePersistence();
  const bootstrap = await getBootstrap(viewerId);
  if (viewerId === "friend" && !bootstrap.friendProfile.name) {
    redirect("/profile?setup=1");
  }
  return <Messenger bootstrap={bootstrap} />;
}
