"use server";

import { getInbounds } from "@/lib/data";
import { inboundSearchParamsSchema, type Inbound, type Paginated } from "@/types";

/**
 * 입고 목록 조회 서버 액션 — 검색 조건을 URL에 싣지 않는 화면 전환(사용자 확정 2026-08-05)
 * 이후의 재조회 경로. 브라우저는 이 액션만 호출하고(URL은 /inbound 고정) Java 호출·세션
 * 스코핑·목 폴백은 전부 서버의 lib/data(getInbounds)가 담당한다 — 원칙 1(모든 데이터 접근은
 * lib/data 경유)·원칙 3(브라우저→Java 직접 호출 금지) 그대로.
 *
 * 서버 액션은 공개 엔드포인트라 입력을 신뢰하지 않는다 — URL 시절과 동일하게 zod로 좁힌다
 * (enum 벗어난 status/dateField는 필드 단위 catch로 무시, 전체 실패 시 기본 조회).
 * 비로그인 호출은 lib/data의 requireSession이 /login으로 redirect — 서버 액션의
 * NEXT_REDIRECT는 클라이언트 내비게이션으로 이어진다.
 */
export async function searchInbounds(input: unknown): Promise<Paginated<Inbound>> {
  const parsed = inboundSearchParamsSchema.safeParse(input);
  return getInbounds(parsed.success ? parsed.data : {});
}
