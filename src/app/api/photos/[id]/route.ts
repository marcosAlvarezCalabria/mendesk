import { clearSessionCookie, getSessionToken } from "@/infrastructure/auth/sessionCookie";

export const dynamic = "force-dynamic";

type PhotoRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: PhotoRouteContext): Promise<Response> {
  const token = await getSessionToken();

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const base = process.env.DIRECTUS_URL;

  if (!base) {
    return new Response("DIRECTUS_URL is not set", { status: 500 });
  }

  const upstream = await fetch(`${base}/assets/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (upstream.status === 401) {
    await clearSessionCookie();

    return new Response("Unauthorized", { status: 401 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "private, no-store",
    },
  });
}