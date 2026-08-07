import { PageHeader } from "@/components/common/page-header";
import { SearchPanel, SelectOption } from "@/components/common/search-panel";
import { Button } from "@/components/ui/button";
import { DEFAULT_PAGE_SIZE, OUTBOUND_DATE_FIELD, OUTBOUND_DATE_FIELD_LABEL, OUTBOUND_DELIVERY_FILTER, OUTBOUND_DELIVERY_LABEL, OUTBOUND_STATUS_FILTER, OUTBOUND_STATUS_LABEL, OutboundSearchParams, WMS_LINK_ALL } from "@/types";
import { getWmsLinkOptions, requireSession } from "@/lib/data";
import { OutboundTable } from "./_components/outbound-table";
import { recentPeriodKst, toEpochSeconds } from "@/lib/utils/datetime";
import { headers } from "next/headers";



export default async function OutboundPage() {

    const period = recentPeriodKst(7);


    // ⚠️ 임시(화면 골격 단계): 목록 데이터는 아직 불러오지 않고 빈 테이블만 렌더한다.   
    const [, wmsLinks] = await Promise.all([
        requireSession(), // 인증 게이트만 유지(세션 값은 아직 미사용)
        // WMS LINK 필터 옵션 출처 = GET /wmslkmap(확정) — WMS 메뉴(목)와 별개로 실 옵션을 쓴다.
        getWmsLinkOptions(),
    ]);

    // ⚠️ 임시 확인용(골격 점검): 데이터 BFF(GET /api/dtob)를 호출해 응답을 콘솔로 확인한다.
    // RSC가 자기 서버의 Route Handler를 fetch로 도는 건 이 점검에서만 — 원래 서버 조회는
    // lib/data 직접 호출이고(원칙 2), 이 HTTP 경로는 브라우저(axios) 몫이다. 상대 URL은
    // 서버 fetch에서 못 쓰므로 요청 host로 조립하고, BFF의 세션 가드(401)를 통과하려면
    // 쿠키를 수동으로 넘겨야 한다. 로그는 dev 서버 터미널에 찍힌다(브라우저 콘솔에도 미러링).
    const h = await headers();
    const bffRes = await fetch(`http://${h.get("host")}/api/dtob`, {
        headers: { cookie: h.get("cookie") ?? "" },
        cache: "no-store",
    });
    console.log(
        "[dtob 골격 점검] GET /api/dtob →",
        bffRes.status,
        bffRes.ok ? await bffRes.json() : await bffRes.text(),
    );

    // 기준일자 후보 = Req의 searchDt 코드(주문일 ORDER_DT · 배송일 DELIVERY_DT — Swagger enum 확정).
    const DATE_FIELD_OPTIONS: SelectOption[] = OUTBOUND_DATE_FIELD.map((field) => ({
        value: field,
        label: OUTBOUND_DATE_FIELD_LABEL[field],
    }));

    // 출고상태 필터 옵션 — UNKNOW는 응답 전용이라 필터에 없다(OUTBOUND_STATUS_FILTER가 단일 출처).
    const STATUS_OPTIONS: SelectOption[] = OUTBOUND_STATUS_FILTER.map((status) => ({
        value: status,
        label: OUTBOUND_STATUS_LABEL[status],
    }));

    // 배송상태 필터 옵션 — 두 번째 상태 축(nullable). UNKNOW는 응답 전용이라 상태와 같은
    // 규칙으로 필터에서 제외(OUTBOUND_DELIVERY_FILTER). 이쪽도 Req는 배열(다중 선택) 계약.
    const DELIVERY_OPTIONS: SelectOption[] = OUTBOUND_DELIVERY_FILTER.map((delivery) => ({
        value: delivery,
        label: OUTBOUND_DELIVERY_LABEL[delivery],
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
                statusOptions={STATUS_OPTIONS}
                statusLabel="출고상태"
                deliveryOptions={DELIVERY_OPTIONS}
                deliveryLabel="배송상태"
                dateFieldOptions={DATE_FIELD_OPTIONS}
            />


            {/* 임시 빈 상태 — page는 1-기반(DataTable), pageSize=0이면 페이지 수 계산이
              * NaN이 되고 페이지 크기 선택지에 0이 노출되므로 빈 테이블이어도 유효값을 준다. */}
            <OutboundTable
                data={[]}
                total={0}
                page={1}
                pageSize={DEFAULT_PAGE_SIZE}
            />

        </div>
    )
}
