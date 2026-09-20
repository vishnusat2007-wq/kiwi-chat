import { requireHuman } from "@/lib/auth";
import { isDropboxConfigured } from "@/lib/config";
import { json, noContent, readJson } from "@/lib/http";
import { getFriendProfile, saveFriendName } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return noContent();
}

export async function GET(request: Request) {
  const { human, error } = requireHuman(request);
  if (!human) return json(error, 401);

  return json({
    viewerId: human,
    friendProfile: await getFriendProfile(),
    dropboxConfigured: isDropboxConfigured(),
  });
}

export async function POST(request: Request) {
  const { human, error } = requireHuman(request);
  if (!human) return json(error, 401);
  if (human !== "friend") {
    return json(
      {
        error: "forbidden",
        message: "Only the friend login can update this profile.",
      },
      403,
    );
  }

  const body = await readJson<{ name?: unknown }>(request);
  if (!body) return json({ error: "invalid_json" }, 400);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return json(
      { error: "missing_name", message: "Please enter your name." },
      400,
    );
  }
  if (name.length > 40) {
    return json(
      { error: "too_long", message: "Name must be 40 characters or fewer." },
      400,
    );
  }

  const friendProfile = await saveFriendName(name);
  return json({ friendProfile });
}
