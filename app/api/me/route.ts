import { requireHuman } from "@/lib/auth";
import { HUMANS } from "@/lib/config";
import { json } from "@/lib/http";
import { humanDisplayName } from "@/lib/session";
import { getFriendProfile } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const { human, error } = requireHuman(request);
  if (!human) return json(error, 401);

  const friendProfile = getFriendProfile();
  return json({
    user: {
      id: human,
      name: humanDisplayName(human, friendProfile.name),
      username: HUMANS[human].username,
    },
    friendProfile,
  });
}
