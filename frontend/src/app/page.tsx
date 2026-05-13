"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/entities/user/model/authStore";

export default function Home() {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!hydrated) return;
    router.replace(token ? "/lobby" : "/login");
  }, [hydrated, token, router]);

  return (
    <div className="container-narrow">
      <div className="panel">
        <h1 className="title">Turns</h1>
        <p className="muted">불러오는 중…</p>
      </div>
    </div>
  );
}
