import { NextResponse, type NextRequest } from "next/server";
import { AUTH_API } from "@/lib/api";
import { postJavaApi } from "@/lib/api/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  SESSION_COOKIE,
} from "@/lib/data/session";

/**
 * 로그아웃 BFF — Java POST /auth/logout(Req refreshToken)을 best-effort로 호출하고
 * 쿠키 3종을 지운다. 서버 무효화가 실패해도 로컬 쿠키는 항상 지워 로그아웃을 보장한다
 * (PRD: 로그아웃은 별도 화면 없이 즉시 로그인 페이지로 — 이동은 호출부가 담당).
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    await postJavaApi(AUTH_API.logout, { refreshToken });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
