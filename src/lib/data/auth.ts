import type { LoginInput, User } from "@/types";
import { mockUsers } from "@/lib/mock/users";
import { delay } from "./utils";

/**
 * 인증 — Phase 1 목 로그인 (PRD F010).
 * 실제 인증(BFF 세션 발급, httpOnly 쿠키)은 Phase 2에서 이 파일 내부만 교체한다
 * (CLAUDE.md 아키텍처 원칙 2). 성공해도 세션은 만들지 않는다 — Phase 1 세션은
 * lib/mock/session.ts의 CURRENT_USER_ID로 고정이며, 로그인 성공은 화면 이동만 담당한다.
 *
 * 오류는 PRD가 정의한 2종(계정 없음/비밀번호 불일치)만 재현한다.
 * INACTIVE 계정의 로그인 차단 여부는 PRD에 없어 다루지 않는다(Phase 2 확인 대상).
 */

/** 목 계정 공통 비밀번호 — 비밀번호 불일치 오류를 데모하기 위한 고정값 */
export const MOCK_LOGIN_PASSWORD = "reve1234!";

/** 로그인 페이지 개발용 힌트에 쓰는 대표 목 계정 이메일 (user-01, 운영자) */
export const MOCK_LOGIN_SAMPLE_EMAIL = mockUsers[0].email;

export type LoginErrorCode = "ACCOUNT_NOT_FOUND" | "PASSWORD_MISMATCH";

export const LOGIN_ERROR_MESSAGE: Record<LoginErrorCode, string> = {
  ACCOUNT_NOT_FOUND: "등록되지 않은 이메일입니다.",
  PASSWORD_MISMATCH: "비밀번호가 일치하지 않습니다.",
};

export type LoginResult = { ok: true; user: User } | { ok: false; error: LoginErrorCode };

export async function login(input: LoginInput): Promise<LoginResult> {
  await delay();
  const email = input.email.trim().toLowerCase();
  const user = mockUsers.find((u) => u.email.toLowerCase() === email);
  if (!user) return { ok: false, error: "ACCOUNT_NOT_FOUND" };
  if (input.password !== MOCK_LOGIN_PASSWORD) return { ok: false, error: "PASSWORD_MISMATCH" };
  return { ok: true, user };
}
