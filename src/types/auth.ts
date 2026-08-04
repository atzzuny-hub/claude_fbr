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
