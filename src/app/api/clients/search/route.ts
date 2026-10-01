import { NextResponse } from "next/server";

import { ListClients } from "@/application/useCases/ListClients";
import { makeClientListReader } from "@/composition/directus";
import { isAuthError } from "@/infrastructure/auth/authError";
import { clearSessionCookie, getSessionToken } from "@/infrastructure/auth/sessionCookie";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const token = await getSessionToken();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.getAll("search").length === 1 ? searchParams.get("search")! : undefined;
  const rawPage = searchParams.get("page") ?? "1";
  const page = Number(rawPage);
  if (searchParams.getAll("page").length > 1 || !/^\d+$/.test(rawPage) || !Number.isSafeInteger(page) || page < 1) {
    return NextResponse.json({ error: "Invalid page" }, { status: 400, headers });
  }

  try {
    const clients = await new ListClients(makeClientListReader(token)).execute({ page, search });

    return NextResponse.json({
      items: clients.items.map((client) => ({ id: client.id, name: client.name, phone: client.phone?.value ?? null, gdprConsent: client.gdprConsent })),
      hasNextPage: clients.hasNextPage,
    }, { headers });
  } catch (error) {
    if (isAuthError(error)) {
      await clearSessionCookie();

      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }

    throw error;
  }
}
