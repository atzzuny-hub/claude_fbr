import { NextResponse, type NextRequest } from "next/server";
import { AUTH_API } from "@/lib/api";
import { javaApiUrl } from "@/lib/api/server";
import {
  ACCESS_TOKEN_COOKIE,
  AUTH_COOKIES,
  REFRESH_TOKEN_COOKIE,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/auth/cookies";
import { readJwtExp } from "@/lib/auth/jwt";
import {
  authTokenResponseSchema,
  parseWebClientIds,
  resolveRoleFromAuthLevel,
  sessionSchema,
  type AuthTokenResponse,
  type Session,
} from "@/types";

/**
 * 액세스 토큰 선제 갱신 프록시(구 미들웨어) — 레거시 useAjax의 "401 → /auth/token → 재시도" 흐름을
 * 서버 쿠키 아키텍처로 옮긴 것. 쿠키를 고쳐 쓸 수 있는 위치가 미들웨어/Route Handler뿐이라
 * (RSC 렌더 중에는 불가) 사후 재시도 대신 exp 임박 시점의 사전 갱신으로 설계했다.
 *
 * - 액세스 토큰 exp(JWT 페이로드)가 임박/경과하면 /auth/token으로 갱신하고 쿠키를 회전한다
 *   (리프레시 토큰도 매번 회전 — 레거시 확인).
 * - 회전 응답의 auth/webClientIds로 세션 쿠키(역할·소유 마켓)도 함께 갱신한다 — 권한이
 *   서버에서 바뀌었다면 재로그인 없이 다음 요청부터 반영된다.
 * - 갱신 실패(리프레시 만료 등) = 세션 종료: 쿠키를 지우고 페이지 요청은 /login으로,
 *   API 요청은 401로 응답한다.
 * - 같은 리프레시 토큰의 동시 갱신은 하나로 합친다(single-flight) — 회전 때문에 두 번째
 *   요청이 이미 소비된 토큰으로 갱신을 시도하면 실패한다(레거시도 같은 이유로 큐 사용).
 */

/** exp까지 이 여유(초) 미만이면 미리 갱신한다 — 렌더 도중 만료로 인한 데이터 401을 예방 */
const REFRESH_MARGIN_SECONDS = 60;
/** single-flight 항목 보존 시간 — 회전 직후 옛 토큰으로 들어온 지각 요청이 결과를 재사용 */
const INFLIGHT_TTL_MS = 10_000;

const inflightRefresh = new Map<string, Promise<AuthTokenResponse | null>>();

async function requestTokenRefresh(refreshToken: string): Promise<AuthTokenResponse | null> {
  const res = await fetch(javaApiUrl(AUTH_API.refresh), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const parsed = authTokenResponseSchema.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

function refreshOnce(refreshToken: string): Promise<AuthTokenResponse | null> {
  const existing = inflightRefresh.get(refreshToken);
  if (existing) return existing;
  const pending = requestTokenRefresh(refreshToken);
  inflightRefresh.set(refreshToken, pending);
  void pending.finally(() => {
    setTimeout(() => inflightRefresh.delete(refreshToken), INFLIGHT_TTL_MS);
  });
  return pending;
}

/** 회전 응답으로 세션 프로필 재구성 — webClientIds가 응답에 없으면 기존 세션 값을 유지 */
function rebuildSession(data: AuthTokenResponse, previousRaw: string | undefined): Session {
  const role = resolveRoleFromAuthLevel(data.auth);
  let previousClientIds: string[] | null = null;
  if (previousRaw) {
    try {
      const previous = sessionSchema.safeParse(JSON.parse(previousRaw));
      if (previous.success) previousClientIds = previous.data.clientIds;
    } catch {
      // 손상된 기존 세션은 무시 — 회전 응답 기준으로 새로 만든다
    }
  }
  const rotated = parseWebClientIds(data.webClientIds);
  return {
    email: data.email,
    name: data.name,
    role,
    clientIds: role === "OPERATOR" ? null : (rotated ?? previousClientIds ?? []),
  };
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  // 비로그인(쿠키 없음)은 통과 — 화면 가드(requireSession)가 /login으로 보낸다
  if (!accessToken || !refreshToken) return NextResponse.next();

  const exp = readJwtExp(accessToken);
  // exp를 읽지 못하는 토큰(JWT 아님/클레임 없음)은 선제 갱신 대상이 아니다 — 그대로 통과
  if (exp === null) return NextResponse.next();
  if (exp * 1000 - Date.now() > REFRESH_MARGIN_SECONDS * 1000) return NextResponse.next();

  const rotated = await refreshOnce(refreshToken);

  if (!rotated) {
    // 리프레시 실패 = 세션 만료. 페이지는 로그인으로, API는 401로.
    const response = request.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json({ error: "SESSION_EXPIRED" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", request.url));
    for (const name of AUTH_COOKIES) response.cookies.delete(name);
    return response;
  }

  // 이번 요청의 렌더는 기존 세션 쿠키 값으로 진행된다(요청 쿠키는 이미 파싱됨) —
  // 프로필 변화는 다음 요청부터 반영. 토큰이 필요한 데이터 호출은 전부 브라우저발
  // /api 요청(별도 미들웨어 통과)이라 회전된 토큰을 자연히 쓴다.
  const response = NextResponse.next();
  response.cookies.set(ACCESS_TOKEN_COOKIE, rotated.accessToken, SESSION_COOKIE_OPTIONS);
  response.cookies.set(REFRESH_TOKEN_COOKIE, rotated.refreshToken, SESSION_COOKIE_OPTIONS);
  response.cookies.set(
    SESSION_COOKIE,
    JSON.stringify(rebuildSession(rotated, request.cookies.get(SESSION_COOKIE)?.value)),
    SESSION_COOKIE_OPTIONS,
  );
  return response;
}

export const config = {
  // 정적 자원과 인증 라우트(/login 화면, /api/auth/* — 로그인/로그아웃 자체) 제외.
  // /api/auth를 태우면 로그아웃조차 갱신을 시도하는 순환이 생긴다.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|login|api/auth).*)"],
};
