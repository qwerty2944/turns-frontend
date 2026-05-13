"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/entities/user/model/authStore";
import { Lobby } from "@/widgets/lobby/ui/Lobby";

export default function LobbyPage() {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [hydrated, token, router]);

  if (!hydrated || !token) {
    return (
      <div className="container-narrow">
        <div className="panel"><p className="muted">불러오는 중…</p></div>
      </div>
    );
  }
  return <Lobby />;
}
