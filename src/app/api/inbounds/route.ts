import { NextResponse, type NextRequest } from "next/server";
import { getInboundWireRows } from "@/lib/data";
import { getSession } from "@/lib/data/session";
import { ApiError } from "@/lib/api/server";
import { inboundSearchParamsSchema } from "@/types";

/**
 * 입고 목록 데이터 BFF — GET /api/inbounds → Java Res(/dtin) 그대로의 **행 배열**(JSON).
 * 요청 쿼리·응답 바디 모두 Java Req/Res와 같은 모양이다(사용자 확정 2026-08-05 —
 * devtools에서 보이는 것이 곧 Java 계약). 건수는 레거시처럼 별도 GET /api/inbounds/cnt.
 * 정규화(epoch 초→ms · 0→null · 미확정 status 강등)는 화면이 공용 변환
 * (types/inbound.ts wireInboundSchema·toDomainInbound)으로 한다.
 *
 * 이 프로젝트는 서버 액션을 쓰지 않는다(원칙 7) — 화면이 axios로 이 라우트를 호출하고,
 * 여기서 lib/data를 경유해 Java를 호출한다(원칙 1·3: 브라우저는 Java를 직접 치지 않는다).
 * 쿼리는 신뢰하지 않는 입력 — zod로 좁힌다(수치 coerce, 어긋난 필드 개별 무시).
 */
export async function GET(request: NextRequest) {
  // 비로그인은 리디렉션 대신 401 JSON — axios 호출부(화면)가 /login 이동을 담당한다.
  if (!(await getSession())) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = inboundSearchParamsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  const params = parsed.success ? parsed.data : {};

  try {
    return NextResponse.json(await getInboundWireRows(params));
  } catch (error) {
    // lib/data의 표준 에러는 상태·메시지를 그대로 JSON으로 — 그 외(NEXT_REDIRECT 포함)는 Next가 처리
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
}
