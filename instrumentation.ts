export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { getDb } = await import("./lib/db");
  getDb();
}
