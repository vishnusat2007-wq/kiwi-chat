import { Messenger } from "@/components/messenger";
import { requirePageSession } from "@/lib/page-auth";
import { getBootstrap } from "@/lib/store";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  const viewerId = await requirePageSession();
  const bootstrap = getBootstrap(viewerId);
  if (viewerId === "friend" && !bootstrap.friendProfile.name) {
    redirect("/profile?setup=1");
  }
  return <Messenger bootstrap={bootstrap} />;
}
