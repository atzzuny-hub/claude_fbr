import type { Paginated, User, UserInput, UserSearchParams, UserUpdateInput } from "@/types";
import { mockClients } from "@/lib/mock/clients";
import { mockUsers } from "@/lib/mock/users";
import { delay, matchesKeyword, paginate } from "./utils";

/**
 * User (사용자) — 운영자 전용 메뉴(F009). 역할 스코핑 대상 아님(전 화면 동일 데이터).
 */
let users: User[] = [...mockUsers];

const clientsById = new Map(mockClients.map((client) => [client.id, client]));

export async function getUsers(params: UserSearchParams = {}): Promise<Paginated<User>> {
  await delay();
  const filtered = users.filter((user) => {
    if (params.role && user.role !== params.role) return false;
    if (params.clientId && user.clientId !== params.clientId) return false;
    if (params.status && user.status !== params.status) return false;
    if (!matchesKeyword(params.keyword, user.email, user.name, user.clientName)) return false;
    return true;
  });
  return paginate(filtered, params.page, params.pageSize);
}

export async function getUser(id: string): Promise<User | null> {
  await delay();
  return users.find((user) => user.id === id) ?? null;
}

// 계정 발급 — 회원가입이 없어 운영자의 계정 발급이 유일한 신규 사용자 등록 경로(F009)
export async function createUser(input: UserInput): Promise<User> {
  await delay();
  const owner = input.clientId ? clientsById.get(input.clientId) : undefined;
  const now = new Date().toISOString();
  const newUser: User = {
    id: `user-${users.length + 1}`,
    email: input.email,
    name: input.name,
    role: input.role,
    clientId: input.clientId ?? null,
    clientName: owner?.name ?? null,
    status: "ACTIVE",
    createdAt: now,
    lastLoginAt: null,
  };
  users = [newUser, ...users];
  return newUser;
}

// 계정 정보 수정/비활성화 공통 진입점
export async function updateUser(id: string, input: UserUpdateInput): Promise<User | null> {
  await delay();
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) return null;
  const current = users[index];
  const nextClientId = input.clientId !== undefined ? input.clientId : current.clientId;
  const owner = nextClientId ? clientsById.get(nextClientId) : undefined;

  const updated: User = {
    ...current,
    ...input,
    clientId: nextClientId,
    clientName: nextClientId ? owner?.name ?? current.clientName : null,
  };
  users = users.map((user, i) => (i === index ? updated : user));
  return updated;
}

export async function deactivateUser(id: string): Promise<User | null> {
  return updateUser(id, { status: "INACTIVE" });
}
