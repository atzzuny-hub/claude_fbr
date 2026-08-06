import { PageHeader } from "@/components/common/page-header";
import { SearchPanel, SelectOption } from "@/components/common/search-panel";
import { Button } from "@/components/ui/button";
import { DEFAULT_PAGE_SIZE, OUTBOUND_DATE_FIELD, OUTBOUND_DATE_FIELD_LABEL, OutboundSearchParams, WMS_LINK_ALL } from "@/types";
import { getOutbounds, getWmsLinkOptions, requireSession } from "@/lib/data";
import { recentPeriodKst, toEpochSeconds } from "@/lib/utils/datetime";
import { OutboundTable } from "./_components/outbound-table";



export default async function Page() {

    const period = recentPeriodKst(7); // 기본 기간 = 최근 1주(사용자 확정) — 기간은 Req 필수 파라미터

    const initialParams: OutboundSearchParams = {
        wmsLinkId: String(WMS_LINK_ALL), // 전체 — Req와 동일하게 항상 싣는다(빼면 Java가 조용히 0건)
        startDt: toEpochSeconds(period.from, false),
        endDt: toEpochSeconds(period.to, true),
        pageNo: 0,
        pageSize: DEFAULT_PAGE_SIZE,
    };

    const [session, initialData, wmsLinks] = await Promise.all([
        requireSession(),
        getOutbounds(initialParams),
        // WMS LINK 필터 옵션 출처 = GET /wmslkmap(확정) — WMS 메뉴(목)와 별개로 실 옵션을 쓴다.
        getWmsLinkOptions(),
    ]);

    // 기준일자 후보 = Req의 searchDt 코드(주문일 ORDER_DT · 배송일 ).
    // 입고완료일은 응답에 표시할 필드가 없어 목록 컬럼에는 없다(검색 기준으로만 존재 — TBD 참조).
    const DATE_FIELD_OPTIONS: SelectOption[] = OUTBOUND_DATE_FIELD.map((field) => ({
    value: field,
    label: OUTBOUND_DATE_FIELD_LABEL[field],
    }));

    // 필터 옵션 value = 입고 행이 참조하는 수치 ID(idx) — Req의 wmsLinkId(int)와 1:1.
    const wmsLinkOptions: SelectOption[] = wmsLinks.map((link) => ({
        value: String(link.idx),
        label: link.name,
    }));

    return (
        <div>
            <PageHeader 
                title="출고현황" 
                breadcrumbs={[{label:"출고현황"}]}
                actions={
                    <div>
                        <Button variant="link" size="sm">버튼1</Button>
                        <Button variant="link" size="sm">버튼2</Button>
                        <Button variant="link" size="sm">버튼3</Button>
                    </div>
                }
            />

            <SearchPanel 
                role={"OPERATOR"} 
                wmsLinkOptions={wmsLinkOptions}
                dateFieldOptions={DATE_FIELD_OPTIONS} 
            />
            

            <OutboundTable/>

        </div>
    )
}