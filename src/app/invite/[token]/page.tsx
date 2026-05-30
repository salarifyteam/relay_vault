import Link from "next/link";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/mongodb";
import { getCurrentDeveloper } from "@/lib/auth";
import TenantInvite from "@/lib/models/TenantInvite";
import Tenant from "@/lib/models/Tenant";
import { AcceptInviteButton } from "./AcceptInviteButton";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await dbConnect();

  const invite = await TenantInvite.findOne({ token }).lean();
  const valid = !!invite && !invite.usedAt && invite.expiresAt.getTime() > Date.now();

  const me = await getCurrentDeveloper();
  if (!me) {
    // 로그인 안 된 상태 → 구글 로그인 거쳐 다시 이 페이지로
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const tenant = invite ? await Tenant.findById(invite.tenantId).select({ name: 1 }).lean() : null;

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 480, margin: "80px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Team invitation</h1>
      {!valid || !tenant ? (
        <>
          <p style={{ color: "#697386" }}>
            {invite?.usedAt
              ? "This invite has already been used."
              : invite && invite.expiresAt.getTime() < Date.now()
              ? "This invite has expired."
              : "This invite is invalid."}
          </p>
          <p style={{ marginTop: 20 }}>
            <Link href="/console" style={{ color: "#635bff" }}>Go to console →</Link>
          </p>
        </>
      ) : (
        <>
          <p style={{ color: "#425466", lineHeight: 1.6 }}>
            You&apos;ve been invited to join <strong>{tenant.name}</strong> as a <strong>member</strong>.
            You&apos;ll be able to manage API keys, end-users, and settings.
          </p>
          <p style={{ color: "#697386", fontSize: 13, marginTop: 6 }}>
            Signed in as <strong>{me.account.email}</strong>.
          </p>
          <AcceptInviteButton token={token} />
        </>
      )}
    </main>
  );
}
