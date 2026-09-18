import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./config";
import { verifySessionToken } from "./session";
import type { PersonId } from "./config";

export async function getPageSession(): Promise<PersonId | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requirePageSession(): Promise<PersonId> {
  const id = await getPageSession();
  if (!id) redirect("/login");
  return id;
}
