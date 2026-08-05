import { NextResponse, type NextRequest } from "next/server";
import { getInboundCount } from "@/lib/data";
import { getSession } from "@/lib/data/session";
import { ApiError } from "@/lib/api/server";
import { inboundSearchParamsSchema } from "@/types";

/**
 * 입고 건수 데이터 BFF — GET /api/inbounds/cnt → Java Res(/dtin/cnt) 그대로의 **숫자**(JSON).
 * Req는 목록과 동일 필터에 페이지 파라미터만 없다(확정 스펙). 화면은 레거시 관례대로
 * 첫 페이지(pageNo 0) 조회에만 이걸 함께 부른다 — /api/inbounds(목록)와 한 쌍.
 */
export async function GET(request: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = inboundSearchParamsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  const params = parsed.success ? parsed.data : {};

  try {
    return NextResponse.json(await getInboundCount(params));
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
}
