import { NextResponse } from "next/server";
import { AUTH_API } from "@/lib/api";
import { javaApiUrl } from "../../_lib/java-api";
import {
  authLoginResponseSchema,
  loginInputSchema,
  parseWebClientIds,
  resolveRoleFromAuthLevel,
  type Session,
} from "@/types";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/data/session";

/**
 * 로그인 BFF (PRD F010) — Java POST /auth/login을 대리 호출한다.
 * 성공 시 httpOnly 쿠키 3종(액세스/리프레시 토큰 + 화면용 세션 프로필)을 심고,
 * 응답 바디에는 토큰을 절대 싣지 않는다(원칙 5). 실패는 코드만 내려보내고
 * 문구 매핑은 lib/data/auth의 LOGIN_ERROR_MESSAGE가 담당한다.
 * ※ Java가 계정 없음/비밀번호 불일치를 구분해 주지 않아(둘 다 401 빈 바디) 401 하나로 취급.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const input = loginInputSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const upstream = await fetch(javaApiUrl(AUTH_API.login), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input.data),
    cache: "no-store",
  }).catch(() => null);

  if (!upstream) return NextResponse.json({ error: "UPSTREAM_UNREACHABLE" }, { status: 502 });
  if (upstream.status === 401) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }
  if (!upstream.ok) return NextResponse.json({ error: "UPSTREAM_ERROR" }, { status: 502 });

  const json: unknown = await upstream.json().catch(() => null);
  const parsed = authLoginResponseSchema.safeParse(json);
  if (!parsed.success) {
    // 스펙(사용자 제공)과 실제 응답이 다르면 여기서 걸린다 — 필드 확인 후 스키마를 갱신한다.
    console.error("[api/auth/login] 로그인 응답이 authLoginResponseSchema와 다릅니다:", parsed.error);
    return NextResponse.json({ error: "UPSTREAM_SCHEMA_MISMATCH" }, { status: 502 });
  }

  const { email, name, accessToken, refreshToken } = parsed.data;
  const role = resolveRoleFromAuthLevel(parsed.data.auth);
  const session: Session = {
    email,
    name,
    role,
    // 운영자는 null(전체). CLIENT인데 목록이 없으면 빈 배열 — 아무 데이터도 안 보이는 게
    // 맞는 보수적 기본(webClientIds는 기본 권한 이하에서만 온다 — 사용자 확정).
    clientIds: role === "OPERATOR" ? null : (parseWebClientIds(parsed.data.webClientIds) ?? []),
  };

  const response = NextResponse.json({ email, name, role });
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, SESSION_COOKIE_OPTIONS);
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, SESSION_COOKIE_OPTIONS);
  response.cookies.set(SESSION_COOKIE, JSON.stringify(session), SESSION_COOKIE_OPTIONS);
  return response;
}
