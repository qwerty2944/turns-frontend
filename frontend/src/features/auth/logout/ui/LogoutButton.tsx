"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/entities/user/model/authStore";

export const LogoutButton = () => {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);
  return (
    <button
      onClick={() => {
        clear();
        router.replace("/login");
      }}
    >
      로그아웃
    </button>
  );
};
