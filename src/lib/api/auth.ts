/**
 * 인증 Java API 엔드포인트 — 사용자 제공 스펙(2026-08-04). 모두 POST · JSON 바디.
 * 로그인 실패는 HTTP 401 + 빈 바디로 확인됨(프로브) — 계정 없음/비밀번호 불일치가
 * 구분되어 오는지는 실 계정 테스트로 확인 필요(PRD는 두 문구를 구분 표시).
 *
 * 토큰은 응답 바디(accessToken/refreshToken)로 온다 — 브라우저에는 BFF가 httpOnly
 * 쿠키로만 심는다(CLAUDE.md 원칙 5). ※ refresh(/auth/token)의 응답 형태는 미확인(TBD) —
 * 확인 전에 재발급 로직을 구현하지 않는다.
 */
export const AUTH_API = {
  /** POST 로그인 — Req { email, password } → Res authLoginResponseSchema(@/types) */
  login: "/auth/login",
  /** POST 로그아웃 — Req { refreshToken } → Res true */
  logout: "/auth/logout",
  /** POST 액세스 토큰 재발급 — Req { refreshToken } → Res 형태 확인 필요(TBD) */
  refresh: "/auth/token",
} as const;
