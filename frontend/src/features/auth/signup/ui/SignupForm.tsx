"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignupMutation } from "../api";
import { extractApiError } from "@/shared/api/axios";

export const SignupForm = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const { mutateAsync, isPending } = useSignupMutation();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다");
      return;
    }
    try {
      await mutateAsync({ email, password, passwordConfirm, nickname });
      router.push("/lobby");
    } catch (err) {
      setError(extractApiError(err));
    }
  };

  return (
    <div className="panel col">
      <h1 className="title" style={{ margin: 0 }}>회원가입</h1>
      <form className="col" onSubmit={onSubmit}>
        <label className="col" style={{ gap: 4 }}>
          <span className="muted">이메일</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="col" style={{ gap: 4 }}>
          <span className="muted">닉네임 (선택)</span>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={12} />
        </label>
        <label className="col" style={{ gap: 4 }}>
          <span className="muted">비밀번호 (6자 이상)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        <label className="col" style={{ gap: 4 }}>
          <span className="muted">비밀번호 확인</span>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            minLength={6}
            required
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={isPending}>
          {isPending ? "가입 중…" : "회원가입"}
        </button>
      </form>
      <div className="muted">
        이미 계정이 있나요? <Link href="/login">로그인</Link>
      </div>
    </div>
  );
};
