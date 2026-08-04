/**
 * 인증 Java API 엔드포인트 — 사용자 제공 스펙(2026-08-04). 모두 POST · JSON 바디.
 * 로그인 실패는 HTTP 401 + 빈 바디로 확인됨(프로브) — 계정 없음/비밀번호 불일치가
 * 구분되어 오는지는 실 계정 테스트로 확인 필요(PRD는 두 문구를 구분 표시).
 *
 * 토큰은 응답 바디(accessToken/refreshToken)로 온다 — 브라우저에는 BFF가 httpOnly
 * 쿠키로만 심는다(CLAUDE.md 원칙 5).
 * 로그인 실패는 401(빈 바디) 또는 500 + errorCode 1006(레거시 확인) 두 형태.
 */
export const AUTH_API = {
  /** POST 로그인 — Req { email, password } → Res authLoginResponseSchema(@/types) */
  login: "/auth/login",
  /** POST 로그아웃 — Req { refreshToken } → Res true */
  logout: "/auth/logout",
  /**
   * POST 액세스 토큰 재발급 — Req { refreshToken } → Res는 로그인과 동일 형태
   * (authTokenResponseSchema). 리프레시 토큰 회전 포함 — src/proxy.ts가 exp 임박 시
   * 선제 갱신한다.
   */
  refresh: "/auth/token",
} as const;
