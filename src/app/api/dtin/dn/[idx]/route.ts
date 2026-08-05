import { NextResponse, type NextRequest } from "next/server";
import { getInboundRowExcel } from "@/lib/data";
import { getSession } from "@/lib/data/session";
import { ApiError } from "@/lib/api/server";

/**
 * 입고 행 상세 엑셀 파일 BFF — GET /api/dtin/dn/{idx} → Java GET /dtin/dn/{idx}(서버 생성
 * 파일, 사용자 확정 2026-08-05)를 그대로 스트리밍한다. 목록 BFF(GET /api/dtin)와 같은 원칙:
 * 브라우저는 Java를 직접 치지 않고(원칙 3), 호출은 lib/data 경유(원칙 1).
 * 파일 응답이라 바디는 무변환 통과시키고, Content-Type·Content-Disposition(파일명)만
 * 업스트림 것을 이어 준다 — 화면(RowExportButton 서버 모드)이 Disposition 파일명으로 저장한다.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ idx: string }> },
) {
  // 비로그인은 리디렉션 대신 401 JSON — fetch 호출부(화면)가 /login 이동을 담당한다.
  if (!(await getSession())) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { idx } = await context.params;
  // idx는 행 고유 번호(양의 정수) — 경로 세그먼트는 신뢰하지 않는 입력이라 형태부터 좁힌다.
  if (!/^\d+$/.test(idx)) {
    return NextResponse.json({ message: "잘못된 행 번호입니다." }, { status: 400 });
  }

  try {
    const upstream = await getInboundRowExcel(Number(idx));
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
