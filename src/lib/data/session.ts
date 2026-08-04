import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionSchema, type Session } from "@/types";

/**
 * 세션 접근 — httpOnly 쿠키 기반(실 인증, 2026-08-04 전환).
 * 로그인 BFF(app/api/auth/login)가 아래 3개 쿠키를 심는다:
 *  - ACCESS/REFRESH_TOKEN_COOKIE: Java API 호출용 JWT — BFF(서버)만 읽는다
 *  - SESSION_COOKIE: 화면용 프로필(sessionSchema JSON) — 역할·이름·소유 마켓 목록
 * 전부 httpOnly라 브라우저 JS는 어느 것도 읽을 수 없다(CLAUDE.md 원칙 5).
 * 토큰 만료(maxAge)는 정책 미확정이라 세션 쿠키(브라우저 종료 시 소멸)로 둔다 — TBD.
 */

export const ACCESS_TOKEN_COOKIE = "reve_access_token";
export const REFRESH_TOKEN_COOKIE = "reve_refresh_token";
export const SESSION_COOKIE = "reve_session";

/** BFF가 세 쿠키를 심을 때 공통 옵션 — httpOnly + lax, 프로덕션에서만 secure */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export type { Session };

/** 현재 세션 — 비로그인(쿠키 없음/손상)이면 null. 화면 가드는 requireSession을 쓴다. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = sessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** 로그인 필수 컨텍스트용 — 세션이 없으면 로그인 페이지로 보낸다(PRD: 비로그인 접근 리디렉션) */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * 역할 스코핑 (CLAUDE.md 사용자 역할 & 데이터 스코핑) — 계정↔마켓 1:N(사용자 확정) 반영.
 * 반환값 = 조회를 허용할 클라이언트 ID 목록, undefined = 전체(스코핑 없음).
 * - OPERATOR: 요청한 clientId 하나로 좁히거나(필터), 미지정 시 전체.
 * - CLIENT: 세션의 소유 목록으로 강제. 요청 clientId가 소유 목록 안이면 그 하나로 좁히고,
 *   밖이면 무시한다. 소유 목록이 비어 있으면 빈 배열(=아무것도 매칭 안 됨, 보수적 차단).
 */
export function resolveClientScope(session: Session, requestedClientId?: string): string[] | undefined {
  if (session.role !== "CLIENT") return requestedClientId ? [requestedClientId] : undefined;
  const owned = session.clientIds ?? [];
  if (requestedClientId && owned.includes(requestedClientId)) return [requestedClientId];
  return owned;
}

/** 단건 조회 가드 — CLIENT는 소유 목록에 있는 클라이언트의 데이터만 접근할 수 있다 */
export function canAccessClient(session: Session, clientId: string): boolean {
  if (session.role !== "CLIENT") return true;
  return (session.clientIds ?? []).includes(clientId);
}
