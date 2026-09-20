import { requireHuman } from "@/lib/auth";
import { json, noContent } from "@/lib/http";
import { clearFriendDropbox } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return noContent();
}

export async function POST(request: Request) {
  const { human, error } = requireHuman(request);
  if (!human) return json(error, 401);
  if (human !== "friend") {
    return json(
      {
        error: "forbidden",
        message: "Only the friend login can disconnect Dropbox.",
      },
      403,
    );
  }

  return json({ friendProfile: await clearFriendDropbox() });
}
