import { Landing } from "@/components/landing";
import { getPageSession } from "@/lib/page-auth";
import { humanDisplayName } from "@/lib/session";
import { ensurePersistence, getFriendProfile } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  const viewerId = await getPageSession();
  if (viewerId) await ensurePersistence();
  const friendProfile = viewerId ? await getFriendProfile() : null;
  return (
    <Landing
      signedIn={Boolean(viewerId)}
      viewerName={
        viewerId
          ? humanDisplayName(viewerId, friendProfile?.name)
          : undefined
      }
    />
  );
}
