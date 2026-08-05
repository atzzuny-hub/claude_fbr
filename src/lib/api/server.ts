/**
 * Java API 호출 헬퍼 — 서버 전용(미들웨어·BFF Route Handler·lib/data에서만 import).
 * 배럴(index.ts)에서 재수출하지 않는다 — 경로 정의(도메인 파일)와 달리 이 파일은
 * API_BASE_URL(서버 전용 env)에 접근하므로 클라이언트 그래프에 섞이면 안 된다.
 * lib/data(도메인 데이터 계층, RSC 전용 next/headers 의존)가 직접 호출하는 것도 허용 대상 —
 * 브라우저가 아니라 서버 렌더 중 호출이라 원칙 3(브라우저 → Java 직접 호출 금지) 위반이
 * 아니다. RSC(page.tsx)가 lib/data만 거치는 현 구조에서는 별도 Route Handler 없이도
 * "브라우저는 Java를 직접 못 친다"가 그대로 지켜진다(입고 도메인 연동 결정, 2026-08-05).
 */

import { buildQueryString, type QueryValue } from "@/lib/utils/search-params";

export function javaApiUrl(path: string): string {
  const base = process.env.API_BASE_URL;
  if (!base) {
    throw new Error("API_BASE_URL 환경변수가 없습니다 — .env.local(dev)/.env.production을 확인하세요.");
  }
  return `${base.replace(/\/+$/, "")}${path}`;
}

/** JSON POST 공통 래퍼 — 네트워크 실패는 null로 수렴시켜 호출부가 502로 응답하게 한다 */
export async function postJavaApi(path: string, body: unknown): Promise<Response | null> {
  return fetch(javaApiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  }).catch(() => null);
}

/**
 * JSON GET 공통 래퍼 — Bearer 액세스 토큰이 필요한 조회형 엔드포인트용(postJavaApi는 로그인·
 * 토큰갱신처럼 인증 전에 쓰는 호출이라 별도). query는 undefined/null/빈 문자열 키를 생략하고
 * querystring으로 직렬화한다(buildQueryString 재사용 — 순수 UI 유틸이지만 시크릿 의존이 없어
 * 경계 재사용에 문제 없음). 네트워크 실패는 postJavaApi와 동일하게 null로 수렴시킨다.
 */
export async function getJavaApi(
  path: string,
  options: { query?: Record<string, QueryValue>; accessToken: string },
): Promise<Response | null> {
  const qs = options.query ? buildQueryString(options.query) : "";
  return fetch(javaApiUrl(qs ? `${path}?${qs}` : path), {
    method: "GET",
    headers: { Authorization: `Bearer ${options.accessToken}` },
    cache: "no-store",
  }).catch(() => null);
}

/**
 * Java API 호출 표준 에러 — lib/data가 던지고, 화면에는 아직 별도 에러 바운더리가 없어
 * Next.js 기본 에러 처리로 전달된다(이번 범위에는 화면 에러 UI 추가가 없음 — 필요 시 별도 작업).
 * code는 JAVA_API_ERROR_CODE(types/common.ts) 카탈로그 값이 있을 때만 채운다.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
