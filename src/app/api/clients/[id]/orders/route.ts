import { NextResponse } from "next/server";

import { GetClient } from "@/application/useCases/GetClient";
import { makeClientRepository } from "@/composition/directus";
import { ClientNotFoundError } from "@/domain/errors/ClientNotFoundError";
import { isAuthError } from "@/infrastructure/auth/authError";
import { clearSessionCookie, getSessionToken } from "@/infrastructure/auth/sessionCookie";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const { id } = await context.params;
  try {
    const history = await new GetClient(makeClientRepository(token)).execute(id);
    return NextResponse.json({
      items: history.orders.map(order => ({ id: order.id, orderNumber: order.orderNumber.value, status: order.status.value })),
    }, { headers });
  } catch (error) {
    if (isAuthError(error)) {
      await clearSessionCookie();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }
    if (error instanceof ClientNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404, headers });
    throw error;
  }
}
