import type { LoginInput } from "@/types";

/**
 * 인증 — 실 로그인(2026-08-04 전환). 브라우저는 BFF(app/api/auth/*)만 호출하고,
 * BFF가 Java API(/auth/login·/auth/logout)를 대리 호출해 httpOnly 쿠키를 관리한다.
 * 토큰·세션 값은 이 계층(클라이언트 코드)에 절대 노출되지 않는다.
 *
 * ※ PRD F010은 오류 2종(계정 없음/비밀번호 불일치) 구분 표시를 요구하지만, 실 API가
 *   구분 정보를 주지 않아(401 빈 바디 또는 500+errorCode 1006) 단일 문구로 통합했다 —
 *   레거시 프런트도 같은 이유로 단일 문구였다. PRD 갱신 필요 사항으로 사용자에게 보고됨.
 */

export type LoginErrorCode = "INVALID_CREDENTIALS" | "SERVER_ERROR";

export const LOGIN_ERROR_MESSAGE: Record<LoginErrorCode, string> = {
  // 문구는 레거시 프런트의 로그인 실패 문구를 계승한다
  INVALID_CREDENTIALS: "이메일 또는 비밀번호가 잘못되었습니다.",
  SERVER_ERROR: "로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
};

export type LoginResult = { ok: true } | { ok: false; error: LoginErrorCode };

export async function login(input: LoginInput): Promise<LoginResult> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => null);
  if (!res) return { ok: false, error: "SERVER_ERROR" };
  if (res.ok) return { ok: true };
  return { ok: false, error: res.status === 401 ? "INVALID_CREDENTIALS" : "SERVER_ERROR" };
}

/** 로그아웃 — BFF가 Java 로그아웃(best-effort) 후 쿠키 3종을 지운다. 호출부는 /login 이동만. */
export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
}
