const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function corsHeaders() {
  return CORS;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: CORS,
  });
}

export function noContent() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
