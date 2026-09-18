export function createId(prefix: "cnv" | "msg") {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function nowIso() {
  return new Date().toISOString();
}
