import type { User } from "@/types";
import { mockClients } from "./clients";
import { pad, pickDate, toDatetime } from "./seed-helpers";

/**
 * User 목데이터 — Client 다음에 정의(clientId 참조 무결성).
 * 운영자 4명 + 클라이언트 계정 14명(client-01~client-14에 1:1 배정, ※CLAUDE.md TBD 잠정 가정).
 * user-01은 lib/mock/session.ts의 기본 목 세션(OPERATOR)으로 사용된다.
 */

const OPERATORS: Omit<User, "clientId" | "clientName">[] = [
  { id: "user-01", email: "operator1@reve-admin.example.com", name: "김운영", role: "OPERATOR", status: "ACTIVE", createdAt: "2025-01-05T09:00:00Z", lastLoginAt: "2026-07-31T08:10:00Z" },
  { id: "user-02", email: "operator2@reve-admin.example.com", name: "박운영", role: "OPERATOR", status: "ACTIVE", createdAt: "2025-01-05T09:00:00Z", lastLoginAt: "2026-07-30T09:20:00Z" },
  { id: "user-03", email: "operator3@reve-admin.example.com", name: "이운영", role: "OPERATOR", status: "ACTIVE", createdAt: "2025-03-11T09:00:00Z", lastLoginAt: "2026-07-29T09:40:00Z" },
  { id: "user-04", email: "operator4@reve-admin.example.com", name: "최운영", role: "OPERATOR", status: "INACTIVE", createdAt: "2025-06-01T09:00:00Z", lastLoginAt: null },
];

const mockOperators: User[] = OPERATORS.map((op) => ({ ...op, clientId: null, clientName: null }));

// client-01 ~ client-14에 1:1 배정 (user-05 ~ user-18)
const CLIENT_USER_TARGETS = mockClients.slice(0, 14);
const INACTIVE_CLIENT_USER_INDEXES = new Set([5, 12]);

const mockClientUsers: User[] = CLIENT_USER_TARGETS.map((client, j) => {
  const status: User["status"] = INACTIVE_CLIENT_USER_INDEXES.has(j) ? "INACTIVE" : "ACTIVE";
  const createdDate = pickDate(j, 9);
  const lastLoginDate = pickDate(j, 10);

  const user: User = {
    id: `user-${pad(j + 5, 2)}`,
    email: `${client.id}@clients.example.com`,
    name: `${client.name} 담당자`,
    role: "CLIENT",
    clientId: client.id,
    clientName: client.name,
    status,
    createdAt: toDatetime(createdDate, "09:00:00"),
    lastLoginAt: status === "ACTIVE" ? toDatetime(lastLoginDate, "08:00:00") : null,
  };
  return user;
});

export const mockUsers: User[] = [...mockOperators, ...mockClientUsers];
