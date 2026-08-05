import { NextResponse, type NextRequest } from "next/server";
import { getInboundExcel } from "@/lib/data";
import { getSession } from "@/lib/data/session";
import { ApiError } from "@/lib/api/server";
import { inboundSearchParamsSchema } from "@/types";

/**
 * 입고 검색결과 전체 엑셀 파일 BFF — GET /api/dtin/dn → Java GET /dtin/dn(서버 생성 파일,
 * 사용자 확정 2026-08-05). Req는 목록(/dtin)과 완전히 동일한 계약(필터 + pageNo·pageSize
 * 필수 — 사용자 제공 Req로 확정)이라 쿼리를 같은 zod로 좁혀 그대로 넘기고, 행 상세 파일
 * BFF(dn/[idx])와 같은 방식으로 파일 바디를 무변환 스트리밍한다(Content-Type·
 * Content-Disposition만 이어줌).
 */
export async function GET(request: NextRequest) {
  // 비로그인은 리디렉션 대신 401 JSON — fetch 호출부(화면)가 /login 이동을 담당한다.
  if (!(await getSession())) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = inboundSearchParamsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  const params = parsed.success ? parsed.data : {};

  try {
    const upstream = await getInboundExcel(params);
    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    const disposition = upstream.headers.get("content-disposition");
    if (contentType) headers.set("content-type", contentType);
    if (disposition) headers.set("content-disposition", disposition);
    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
}
