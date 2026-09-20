import { FriendProfile } from "@/components/friend-profile";
import { HUMANS, isDropboxConfigured } from "@/lib/config";
import { requirePageSession } from "@/lib/page-auth";
import { humanDisplayName } from "@/lib/session";
import { getFriendProfile } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string; dropbox?: string }>;
}) {
  const viewerId = await requirePageSession();
  const params = await searchParams;
  const friendProfile = await getFriendProfile();

  return (
    <FriendProfile
      viewer={{
        id: viewerId,
        name: humanDisplayName(viewerId, friendProfile.name),
        username: HUMANS[viewerId].username,
      }}
      friendProfile={friendProfile}
      dropboxConfigured={isDropboxConfigured()}
      setup={params.setup === "1"}
      dropboxStatus={params.dropbox ?? null}
    />
  );
}
