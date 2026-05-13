"use client";

import { useState } from "react";
import { authApi } from "@/entities/user/api/auth";
import { extractApiError } from "@/shared/api/axios";

export const ChangePasswordForm = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (newPassword.length < 6) {
      setError("새 비밀번호는 6자 이상이어야 합니다");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("새 비밀번호가 일치하지 않습니다");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.updatePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
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
        비밀번호 변경
      </h3>
      <input
        type="password"
        autoComplete="current-password"
        placeholder="현재 비밀번호"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />
      <input
        type="password"
        autoComplete="new-password"
        placeholder="새 비밀번호 (6자 이상)"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <input
        type="password"
        autoComplete="new-password"
        placeholder="새 비밀번호 확인"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      {error && <div className="error" style={{ marginTop: 0 }}>{error}</div>}
      {ok && (
        <span className="muted" style={{ fontSize: 13 }}>
          ✓ 비밀번호가 변경되었습니다
        </span>
      )}
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={
            submitting || !currentPassword || !newPassword || !confirmPassword
          }
        >
          {submitting ? "변경 중…" : "변경"}
        </button>
      </div>
    </form>
  );
};
