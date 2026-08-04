import { z } from "zod";

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
  // 권한 레벨 코드(예: "LV1") — 레벨 값 종류와 OPERATOR/CLIENT 매핑은 확인 필요(TBD).
  // 매핑이 확정되기 전에는 역할 분기 로직을 이 값에 걸지 않는다.
  auth: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  tmzn: z.number(), // 타임존 관련 값 — 의미 확인 필요
  utc: z.number(), // UTC 오프셋으로 추정 — 의미 확인 필요
  // 스펙 예시가 배열이 아니라 배열 모양 문자열("['aaaa', 'bbbb']")이다 — 실제 타입 확인
  // 필요. 복수형이라 한 계정의 복수 마켓 소유(CLAUDE.md TBD)를 시사한다.
  webClientIds: z.string(),
});
export type AuthLoginResponse = z.infer<typeof authLoginResponseSchema>;
