import type { UserRole } from "@/types";
import { getMockSession } from "@/lib/mock/session";

/**
 * 세션 접근 — Phase 1은 lib/mock/session.ts의 목 세션을 그대로 반환한다.
 * Phase 2 교체 지점: httpOnly 쿠키 기반 서버 세션 조회로 이 함수 내부만 교체한다
 * (호출부 시그니처는 유지 — CLAUDE.md 아키텍처 원칙 2).
 */

export interface Session {
  userId: string;
  role: UserRole;
  clientId: string | null;
  email: string;
  name: string;
}

export async function getSession(): Promise<Session> {
  return getMockSession();
}

/**
 * 역할 스코핑 시뮬레이션 (CLAUDE.md 사용자 역할 & 데이터 스코핑):
 * - CLIENT: 본인 clientId로 강제 — 파라미터로 받은 clientId는 무시한다.
 * - OPERATOR: params.clientId를 그대로 적용(미지정 시 전체 클라이언트 대상).
 */
export function resolveClientScope(session: Session, requestedClientId?: string): string | undefined {
  if (session.role === "CLIENT") return session.clientId ?? undefined;
  return requestedClientId;
}
