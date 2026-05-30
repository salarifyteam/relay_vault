import { NextRequest, NextResponse } from "next/server";
import { getCurrentDeveloper } from "@/lib/auth";
import Tenant from "@/lib/models/Tenant";
import { requireRole } from "@/lib/requireRole";

export async function PATCH(req: NextRequest) {
  const me = await getCurrentDeveloper();
  if (!me) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }
  const forbidden = requireRole(me, "member");
  if (forbidden) return forbidden;

  let body: { allowedOrigins?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }

  if (!Array.isArray(body.allowedOrigins) || !body.allowedOrigins.every((o) => typeof o === "string")) {
    return NextResponse.json(
      { error: { message: "allowedOrigins must be an array of strings" } },
      { status: 400 }
    );
  }
  const allowedOrigins = (body.allowedOrigins as string[])
    .map((o) => o.trim())
    .filter(Boolean);

  await Tenant.updateOne({ _id: me.tenant._id }, { $set: { allowedOrigins } });
  return NextResponse.json({ allowedOrigins });
}
