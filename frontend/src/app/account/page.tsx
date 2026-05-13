"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/entities/user/model/authStore";
import { ChangeNicknameForm } from "@/features/account/change-nickname/ui/ChangeNicknameForm";
import { ChangePasswordForm } from "@/features/account/change-password/ui/ChangePasswordForm";

const maskEmail = (email: string) => {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, Math.min(3, local.length));
  return `${visible}${local.length > 3 ? "***" : ""}@${domain}`;
};

const initial = (nickname: string) => nickname.slice(0, 1).toUpperCase();

export default function AccountPage() {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  if (!hydrated || !token || !user) {
    return (
      <div className="container-narrow">
        <div className="panel">
          <p className="muted">불러오는 중…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-wide">
      <div
        className="row"
        style={{ justifyContent: "space-between", marginBottom: 16 }}
      >
        <h1 className="title" style={{ margin: 0 }}>내 정보</h1>
        <Link href="/lobby">
          <button>로비로</button>
        </Link>
      </div>

      <div className="panel col" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 16, alignItems: "center" }}>
          <div
            aria-label="avatar"
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, rgba(122,63,255,0.4), rgba(217,182,108,0.4))",
              border: "1px solid rgba(217,182,108,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              color: "var(--gold-soft)",
              fontFamily: "Cormorant Garamond, serif",
              flexShrink: 0,
            }}
          >
            {initial(user.nickname)}
          </div>
          <div className="col" style={{ gap: 4 }}>
            <strong style={{ fontSize: "1.2rem", color: "var(--gold-soft)" }}>
              {user.nickname}
            </strong>
            <span className="muted" style={{ fontSize: 13 }}>
              {maskEmail(user.email)}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <ChangeNicknameForm />
        <ChangePasswordForm />
      </div>
    </div>
  );
}
