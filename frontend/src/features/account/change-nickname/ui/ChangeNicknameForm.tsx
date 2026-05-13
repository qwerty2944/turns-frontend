"use client";

import { useState } from "react";
import { authApi } from "@/entities/user/api/auth";
import { useAuthStore } from "@/entities/user/model/authStore";
import { extractApiError } from "@/shared/api/axios";

export const ChangeNicknameForm = () => {
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    setSubmitting(true);
    try {
      const { token, user: u } = await authApi.updateNickname(nickname.trim());
      setSession(token, u);
      setOk(true);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="panel col" onSubmit={onSubmit}>
      <h3 className="title" style={{ margin: 0, fontSize: "1.05rem" }}>
        닉네임 변경
      </h3>
      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={12}
        placeholder="새 닉네임"
      />
      {error && <div className="error" style={{ marginTop: 0 }}>{error}</div>}
      {ok && (
        <span className="muted" style={{ fontSize: 13 }}>
          ✓ 닉네임이 변경되었습니다
        </span>
      )}
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={
            submitting ||
            !nickname.trim() ||
            nickname.trim() === user?.nickname
          }
        >
          {submitting ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
};
