import { NextResponse, type NextRequest } from "next/server";
import { getInboundExcel } from "@/lib/data";
import { getSession } from "@/lib/data/session";
import { ApiError } from "@/lib/api/server";
import { uploadExcelAsGoogleSheet } from "@/lib/google/sheets";
import { formatEpochDateTime } from "@/lib/utils/datetime";
import { inboundSearchParamsSchema } from "@/types";

/**
 * 입고 검색결과 → 구글 시트 BFF — GET /api/dtin/dn/sheet → Java GET /dtin/dn(파일 BFF와
 * 동일 Req: 필터 + pageNo·pageSize)로 엑셀을 받아 Google Drive에 시트로 변환 업로드하고
 * `{ url }`(웹 열람 주소)을 돌려준다. 화면(GoogleSheetButton)이 그 URL을 새 탭으로 연다.
 * Java 경로가 아니라 BFF 전용 라우트다(구글 연동은 우리 쪽 부가 기능 — lib/google/sheets 참조).
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
    const excel = await upstream.arrayBuffer();
    // 시트 이름 — 생성 시각(KST 표기, 화면 관례와 동일)으로 구분한다. 정리는 폴더에서 수동.
    const url = await uploadExcelAsGoogleSheet(excel, `입고현황 ${formatEpochDateTime(Date.now())}`);
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }
}
