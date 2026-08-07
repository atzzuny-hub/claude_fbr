import { NextResponse } from "next/server";
import { getOutbounds } from "@/lib/data";
import { getSession } from "@/lib/data/session";

/**
 * 출고 목록 데이터 BFF — ⚠️ 골격 점검용 최소 버전(하나씩 확인 중).
 * 지금은 쿼리를 받지 않고 lib/data(목)의 기본 조회 결과에서 **행 배열**만 돌려준다.
 * 이후 단계에서 붙일 것: ① 쿼리 파싱(zod 재검증 — status/delivery는 배열이라 getAll 필요)
 * ② lib/data의 실 API 경로(DATA_SOURCE 스위치) + Res 원문(와이어) 중계 계약 ③ 건수(/cnt).
 */
export async function GET() {
  // 비로그인은 리디렉션 대신 401 JSON — 호출부(화면)가 /login 이동을 담당한다(입고 관례).
  if (!(await getSession())) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { items } = await getOutbounds({});
  return NextResponse.json(items);
}
