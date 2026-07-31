import { z } from "zod";
import { listSearchParamsSchema } from "./common";
import { userRoleSchema, userStatusSchema } from "./status";

/**
 * User (사용자) — 인증 주체.
 * clientId: 클라이언트 역할인 경우의 소속 클라이언트, ※1:1 잠정 가정(CLAUDE.md TBD 유지).
 * 한 계정이 복수 마켓을 소유할 수 있는지는 확인 필요 — 단일 참조로 설계.
 */
export const userSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  role: userRoleSchema,
  clientId: z.string().nullable(), // OPERATOR는 null
  clientName: z.string().nullable(),
  status: userStatusSchema,
  createdAt: z.iso.datetime(),
  lastLoginAt: z.iso.datetime().nullable(),
});
export type User = z.infer<typeof userSchema>;

export const userSearchParamsSchema = listSearchParamsSchema.extend({
  role: userRoleSchema.optional(),
  clientId: z.string().optional(),
  status: userStatusSchema.optional(),
});
export type UserSearchParams = z.infer<typeof userSearchParamsSchema>;

// 계정 발급 입력 — 이메일/역할/소속 클라이언트 지정
export const userInputSchema = z.object({
  email: z.email(),
  name: z.string().min(1),
  role: userRoleSchema,
  clientId: z.string().nullable().optional(),
});
export type UserInput = z.infer<typeof userInputSchema>;

// 계정 정보 수정/비활성화 입력 — 필드 전체 선택적(부분 수정)
export const userUpdateInputSchema = z.object({
  name: z.string().min(1).optional(),
  role: userRoleSchema.optional(),
  clientId: z.string().nullable().optional(),
  status: userStatusSchema.optional(),
});
export type UserUpdateInput = z.infer<typeof userUpdateInputSchema>;
