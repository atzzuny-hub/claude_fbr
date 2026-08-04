import { z } from "zod";
import { userRoleSchema, type UserRole } from "./status";

/**
 * 인증 입력 (PRD F010 로그인) — 이메일/비밀번호 로그인 폼의 제출 전 형식 검증.
 * 서버 측 인증 오류(계정 없음/비밀번호 불일치)는 lib/data/auth의 LoginErrorCode가 담당한다.
 */
export const loginInputSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "이메일을 입력하세요.")
    .pipe(z.email("이메일 형식이 올바르지 않습니다.")),
  password: z.string().min(1, "비밀번호를 입력하세요."),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

/**
 * 로그인 API(POST /auth/login) 응답 — 사용자 제공 스펙(2026-08-04) 그대로.
 * BFF만 이 전체를 다룬다: 토큰은 httpOnly 쿠키로 심고, 브라우저에는 프로필성
 * 필드만 골라 내려보낸다(토큰을 클라이언트 코드에 노출 금지 — CLAUDE.md 원칙 5).
 */
export const authLoginResponseSchema = z.object({
  email: z.string(),
  name: z.string(),
  // 권한 레벨 코드 — LV1~LV9 존재, LV1 = 운영자(사용자 확정). 매핑은 resolveRoleFromAuthLevel.
  auth: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  tmzn: z.number(), // 타임존 관련 값 — 의미 확인 필요
  utc: z.number(), // UTC 오프셋으로 추정 — 의미 확인 필요
  // 접근 가능한 WMS 클라이언트(마켓) ID 목록(사용자 확정) — 기본 권한 이하만 사용,
  // 상위 권한(운영자)은 NULL. 스펙 예시가 배열 모양 문자열("['aaaa', 'bbbb']")이라
  // 문자열/배열/NULL을 모두 수용하고 parseWebClientIds로 정규화한다.
  webClientIds: z.union([z.array(z.string()), z.string()]).nullable().optional(),
});
export type AuthLoginResponse = z.infer<typeof authLoginResponseSchema>;

/**
 * 토큰 재발급(POST /auth/token) 응답 — 로그인 응답과 동일 형태(레거시 useAjax에서 확인:
 * auth·email·name·accessToken·refreshToken·utc·tmzn을 그대로 다시 준다).
 * 리프레시 토큰도 매번 회전(rotate)되므로 갱신 시 두 토큰을 모두 갈아끼운다.
 */
export const authTokenResponseSchema = authLoginResponseSchema;
export type AuthTokenResponse = AuthLoginResponse;

/**
 * auth 레벨 → 화면 역할 매핑.
 * LV1 = 운영자(사용자 확정, 2026-08-04). LV2~LV9의 의미는 미확정 — 확정 전까지는 전부
 * CLIENT로 취급한다(보수 기본값: 오분류 시 권한이 "줄어드는" 방향이라 안전).
 * 레벨별 세분화가 확정되면 이 함수만 갱신한다(역할 분기 단일 출처).
 */
export function resolveRoleFromAuthLevel(authLevel: string): UserRole {
  return authLevel === "LV1" ? "OPERATOR" : "CLIENT";
}

/**
 * webClientIds 정규화 — 실제 배열, 배열 모양 문자열("['aaaa', 'bbbb']"), NULL을 모두
 * string[] | null로 수렴시킨다. 문자열 파싱은 작은따옴표를 JSON 따옴표로 바꾸는
 * 휴리스틱이라(ID에 따옴표가 들어가면 실패) 실 응답으로 타입이 확정되면 단순화한다.
 */
export function parseWebClientIds(raw: string[] | string | null | undefined): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.map(String);
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "null") return null;
  try {
    const parsed: unknown = JSON.parse(trimmed.replace(/'/g, '"'));
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

/**
 * 세션(BFF가 httpOnly 쿠키에 저장하는 프로필) — 토큰은 여기 넣지 않는다(별도 쿠키).
 * clientIds: CLIENT 계정이 접근 가능한 클라이언트(마켓) ID 목록(1:N, 사용자 확정) —
 * 운영자는 null(전체). CLIENT인데 목록이 비면 아무 데이터도 보이지 않는 게 정상(보수).
 */
export const sessionSchema = z.object({
  email: z.string(),
  name: z.string(),
  role: userRoleSchema,
  clientIds: z.array(z.string()).nullable(),
});
export type Session = z.infer<typeof sessionSchema>;
