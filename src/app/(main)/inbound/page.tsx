// PRD: F001(입고현황 조회), F012(목록 검색·엑셀 다운로드), F013(역할별 데이터 스코핑)
// — 입고현황 페이지 (접근 권한: 공통·데이터 스코핑, 로그인 후 기본 진입 화면)
import { getInbounds, getWmsLinkOptions, requireSession } from "@/lib/data";
import { DEFAULT_PAGE_SIZE, WMS_LINK_ALL, type InboundSearchParams } from "@/types";
import { recentPeriodUtc, toEpochSeconds } from "@/lib/utils/datetime";
import { PageHeader } from "@/components/common/page-header";
import type { SelectOption } from "@/components/common/search-panel";
import { InboundScreen } from "./_components/inbound-screen";

/**
 * 검색 조건은 URL에 싣지 않는다(사용자 확정 2026-08-05, CLAUDE.md 원칙 6) — 이 페이지는
 * searchParams를 읽지 않고 항상 기본 조건(최근 1주 UTC · 1페이지)으로 첫 데이터를 서버에서
 * 조회해 내려준다. 이후의 조회·페이지 이동·정렬은 InboundScreen(클라이언트 상태)이 서버
 * 액션으로 갱신하며 URL은 /inbound 그대로다(레거시 SPA와 같은 동작 — 새로고침 시 기본
 * 조건으로 초기화).
 */
export default async function InboundPage() {
  const period = recentPeriodUtc(7); // 기본 기간 = 최근 1주(사용자 확정) — 기간은 Req 필수 파라미터
  // 검색 파라미터는 Req와 동일 계약(startDt/endDt epoch 초 · pageNo 0-기반) — 날짜 문자열은
  // 검색 패널 표시용으로만 따로 내려준다(initialPeriod).
  const initialParams: InboundSearchParams = {
    wmsLinkId: String(WMS_LINK_ALL), // 전체 — Req와 동일하게 항상 싣는다(빼면 Java가 조용히 0건)
    startDt: toEpochSeconds(period.from, false),
    endDt: toEpochSeconds(period.to, true),
    pageNo: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  };

  const [session, initialData, wmsLinks] = await Promise.all([
    requireSession(),
    getInbounds(initialParams),
    // WMS LINK 필터 옵션 출처 = GET /wmslkmap(확정) — WMS 메뉴(목)와 별개로 실 옵션을 쓴다.
    getWmsLinkOptions(),
  ]);

  // 필터 옵션 value = 입고 행이 참조하는 수치 ID(idx) — Req의 wmsLinkId(int)와 1:1.
  const wmsLinkOptions: SelectOption[] = wmsLinks.map((link) => ({
    value: String(link.idx),
    label: link.name,
  }));

  return (
    // lg 이상: 셸이 준 높이를 그대로 채워 목록이 화면 안에 들어오고, 표 안에서만 스크롤된다.
    // lg 미만: 검색 조건이 여러 줄로 감겨 표에 남는 높이가 얇아지므로 페이지 전체 스크롤로 둔다.
    <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
      <PageHeader
        title="입고현황"
        // 홈(REVE-ON)은 PageHeader가 항상 붙인다 — 현재 페이지라 href는 주지 않는다
        breadcrumbs={[{ label: "입고현황" }]}
        className="shrink-0"
        // actions={ // 추후 버튼이 들어갈 자리.. }
      />
      <InboundScreen
        role={session.role}
        wmsLinkOptions={wmsLinkOptions}
        initialPeriod={period}
        initialParams={initialParams}
        initialData={initialData}
      />
    </div>
  );
}
