/**
 * 인증 쿠키 단일 출처 — 미들웨어·BFF(Route Handler)·lib/data/session이 공유한다.
 * 이 파일은 next 런타임 의존이 없어야 한다(미들웨어 번들에 들어감).
 * 전부 httpOnly — 브라우저 JS는 어느 것도 읽을 수 없다(CLAUDE.md 원칙 5).
 */

export const ACCESS_TOKEN_COOKIE = "reve_access_token";
export const REFRESH_TOKEN_COOKIE = "reve_refresh_token";
export const SESSION_COOKIE = "reve_session";

export const AUTH_COOKIES = [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, SESSION_COOKIE] as const;

/** 토큰 만료 정책 미확정(TBD) — maxAge 없이 브라우저 세션 수명으로 둔다 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;
