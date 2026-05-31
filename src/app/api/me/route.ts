import { NextResponse } from "next/server";
import { getCurrentDeveloper } from "@/lib/auth";

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
      allowedOrigins: me.tenant.allowedOrigins,
    },
  });
}
