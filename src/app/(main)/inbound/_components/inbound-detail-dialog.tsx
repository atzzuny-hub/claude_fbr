"use client";

// PRD: F001(입고현황 조회 — 입고 목록/상세 조회 및 입고상태 추적)
// — 행 클릭 시 열리는 입고 상세 팝업. 목록이 이미 받아 둔 행 데이터를 그대로 쓴다(추가 조회 없음).
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusStepper, type StatusStep } from "@/components/common/status-stepper";
import { formatEpochDateTime } from "@/lib/utils/datetime";
import { INBOUND_STATUS_FLOW, INBOUND_STATUS_LABEL, type Inbound } from "@/types";

/** 값이 없는 항목(아직 일어나지 않은 단계·nullable 필드)은 대시로 표시한다 */
const EMPTY = "—";

interface InboundDetailDialogProps {
  /** 표시할 행 — 닫히는 동안에도 내용이 남아 있어야 해서 open과 별도로 유지한다 */
  row: Inbound | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InboundDetailDialog({ row, open, onOpenChange }: InboundDetailDialogProps) {
  // 진행 3단계(예정 → 대기 → 입고). 취소는 파이프라인 밖 종료 상태라 붉은 X 단일 노드로만 표시한다.
  const steps: StatusStep[] = INBOUND_STATUS_FLOW.map((status) => ({
    key: status,
    label: INBOUND_STATUS_LABEL[status],
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>입고 상세</DialogTitle>
          {row && (
            <span className="font-mono text-sm text-muted-foreground">{row.ganNo ?? row.dataId}</span>
          )}
        </DialogHeader>

        {row && (
          <div className="flex flex-col gap-6 px-6 py-6">
            {/* UNKNOW(원본 코드 매핑 실패)는 파이프라인 위치를 알 수 없어 스테퍼를 그리지 않는다 —
             * 아래 입고상태 필드가 "알 수 없음"과 원본 코드를 함께 보여 준다. */}
            {row.status !== "UNKNOW" && (
              <StatusStepper
                steps={steps}
                currentKey={row.status}
                terminal={
                  row.status === "CANCELED" ? { label: INBOUND_STATUS_LABEL.CANCELED } : undefined
                }
                className="px-2"
              />
            )}

            {/* 좁은 화면에서는 한 열, 넓어지면 세 열로 — 라벨 위, 값 아래(읽기 전용) */}
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
              <DetailField label="접수번호" value={row.ganNo ?? EMPTY} mono />
              <DetailField label="클라이언트" value={row.clntName ?? EMPTY} />
              <DetailField label="WMS LINK" value={row.wmsLinkName} />
              <DetailField
                label="입고상태"
                // 원본 코드가 있으면 함께 보여 준다 — 특히 UNKNOW는 원문이 유일한 단서다.
                value={
                  row.statusOriginalCode
                    ? `${INBOUND_STATUS_LABEL[row.status]} (${row.statusOriginalCode})`
                    : INBOUND_STATUS_LABEL[row.status]
                }
              />
              <DetailField label="고객명" value={row.contactName ?? EMPTY} />
              <DetailField label="고객연락처" value={row.contactTel ?? EMPTY} mono />
              <DetailField label="입고접수일" value={formatEpochDateTime(row.reqDt, EMPTY)} mono />
              <DetailField label="배송일" value={formatEpochDateTime(row.sipDt, EMPTY)} mono />
              <DetailField label="도착예정일" value={formatEpochDateTime(row.etaDt, EMPTY)} mono />
              <DetailField label="창고도착일" value={formatEpochDateTime(row.arvDt, EMPTY)} mono />
              <DetailField label="입고 ID" value={row.dataId} mono />
              <DetailField label="정보 변경일" value={formatEpochDateTime(row.updDt, EMPTY)} mono />
            </dl>

            <section className="flex flex-col gap-2">
              <h3 className="text-xs text-tertiary-foreground">
                제품리스트 ({row.prodList.length}) · 전체 {row.prodQty.toLocaleString()}개
              </h3>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-row-alt text-xs text-tertiary-foreground">
                      <th className="px-4 py-2 text-left font-medium">상품명</th>
                      <th className="px-4 py-2 text-right font-medium">접수 수량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.prodList.map((prod, index) => (
                      <tr key={`${prod.sku}-${index}`} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2.5 text-left">{prod.productName}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          {prod.expQty.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button type="button">닫기</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 상세 항목 하나 — 라벨(dt) + 읽기 전용 값(dd)을 입력창 모양 박스로 보여 준다.
 * 수정 화면이 아니라 조회 화면이므로 실제 input을 쓰지 않는다(폼 시맨틱 없이 값만 노출).
 */
function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="text-xs text-tertiary-foreground">{label}</dt>
      <dd
        className={
          "truncate rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" +
          (mono ? " font-mono tabular-nums" : "")
        }
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
