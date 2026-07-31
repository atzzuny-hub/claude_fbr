import type { UserRole } from "@/types";
import { mockUsers } from "./users";

/**
 * 목 세션 — Phase 1 전용. 아래 CURRENT_USER_ID 한 줄만 바꿔서
 * OPERATOR/CLIENT 양쪽 화면을 확인할 수 있다.
 *
 *  - "user-01" : 운영자(OPERATOR) 계정 — 전체 데이터 + 필터 UI
 *  - "user-05" : client-01(Torriden VN) 소속 클라이언트 계정 — 본인 데이터만 자동 스코핑
 *
 * Phase 2에서는 이 파일 대신 실제 서버 세션(쿠키 기반)으로 교체한다.
 */
export const CURRENT_USER_ID = "user-01";

export interface MockSession {
  userId: string;
  role: UserRole;
  clientId: string | null;
  email: string;
  name: string;
}

export function getMockSession(): MockSession {
  const user = mockUsers.find((u) => u.id === CURRENT_USER_ID) ?? mockUsers[0];
  return {
    userId: user.id,
    role: user.role,
    clientId: user.clientId,
    email: user.email,
    name: user.name,
  };
}
