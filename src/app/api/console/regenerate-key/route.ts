import { NextResponse } from "next/server";
import { getCurrentDeveloper } from "@/lib/auth";
import { generateRlyKey } from "@/lib/keys";
import Tenant from "@/lib/models/Tenant";
import { maskByokKey } from "@/lib/services/byokProvider";

export async function POST() {
  const me = await getCurrentDeveloper();
  if (!me) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }
  const rlyKey = generateRlyKey();
  await Tenant.updateOne({ _id: me.tenant._id }, { $set: { rlyKey } });
  return NextResponse.json({ rlyKey, rlyKeyMasked: maskByokKey(rlyKey) });
}
