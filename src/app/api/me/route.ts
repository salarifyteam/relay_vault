import { NextResponse } from "next/server";
import { getCurrentDeveloper } from "@/lib/auth";
import { maskByokKey } from "@/lib/services/byokProvider";

export async function GET() {
  const me = await getCurrentDeveloper();
  if (!me) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }
  return NextResponse.json({
    account: {
      email: me.account.email,
      name: me.account.name,
      picture: me.account.picture,
    },
    tenant: {
      name: me.tenant.name,
      rlyKey: me.tenant.rlyKey,
      rlyKeyMasked: maskByokKey(me.tenant.rlyKey),
      allowedOrigins: me.tenant.allowedOrigins,
    },
  });
}
