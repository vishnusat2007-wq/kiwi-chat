import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexDeploymentUrl } from "./config";

export { api };

export function getConvexClient() {
  const url = convexDeploymentUrl();
  if (!url) {
    throw new Error("Convex is not configured.");
  }
  return new ConvexHttpClient(url);
}

export function isMissingConvexFunctions(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Could not find (public )?function/i.test(message);
}
