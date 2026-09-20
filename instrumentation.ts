export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { ensurePersistence } = await import("./lib/store");
  await ensurePersistence();
}
