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
import { formatDateTime } from "@/lib/utils/datetime";
import { INBOUND_STATUS_FLOW, INBOUND_STATUS_LABEL, type Inbound, type InboundStatus } from "@/types";

/** 각 진행 단계에 해당하는 시점 이름 — 목록의 날짜 컬럼(입고접수일·창고도착일·입고 완료일)과 1:1 */
// const STEP_MILESTONE: Record<(typeof INBOUND_STATUS_FLOW)[number], string> = {
//   SCHEDULED: "입고 접수",
//   WAITING: "창고 도착",
//   RECEIVED: "입고 완료",
// };

/** 값이 없는 항목(아직 도착/완료 전)은 대시로 표시한다 */
const EMPTY = "—";

interface InboundDetailDialogProps {
  /** 표시할 행 — 닫히는 동안에도 내용이 남아 있어야 해서 open과 별도로 유지한다 */
  row: Inbound | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InboundDetailDialog({ row, open, onOpenChange }: InboundDetailDialogProps) {
  // 진행 3단계(예정 → 대기 → 입고). 취소는 파이프라인 밖 종료 상태라 붉은 X 단일 노드로만 표시한다.
  const steps: StatusStep[] = INBOUND_STATUS_FLOW.map((status, index) => ({
    key: status,
    label: INBOUND_STATUS_LABEL[status],
    // caption: `STEP ${index + 1}`,
    // description: STEP_MILESTONE[status],
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>입고 상세</DialogTitle>
          {row && (
            <span className="font-mono text-sm text-muted-foreground">{row.receiptNo}</span>
          )}
        </DialogHeader>

        {row && (
          <div className="flex flex-col gap-6 px-6 py-6">
            <StatusStepper
              steps={steps}
              currentKey={row.status}
              terminal={
                row.status === "CANCELLED" ? { label: INBOUND_STATUS_LABEL.CANCELLED } : undefined
              }
              className="px-2"
            />

            {/* 좁은 화면에서는 한 열, 넓어지면 세 열로 — 라벨 위, 값 아래(읽기 전용) */}
            <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
              <DetailField label="주문번호" value={row.orderNo} mono />
              <DetailField label="WMS LINK" value={row.wmsLinkName} />
              <DetailField label="입고상태" value={INBOUND_STATUS_LABEL[row.status as InboundStatus]} />
              <DetailField label="접수번호" value={row.receiptNo} mono />
              <DetailField label="고객명" value={row.customerName} />
              <DetailField label="고객연락처" value={row.customerContact} mono />
              <DetailField label="입고접수일" value={formatDateTime(row.receiptDate, EMPTY)} mono />
              <DetailField label="창고도착일" value={formatDateTime(row.arrivalDate, EMPTY)} mono />
              <DetailField label="입고 완료일" value={formatDateTime(row.completedDate, EMPTY)} mono />
            </dl>

            <section className="flex flex-col gap-2">
              <h3 className="text-xs text-tertiary-foreground">제품리스트 ({row.lines.length})</h3>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-row-alt text-xs text-tertiary-foreground">
                      <th className="px-4 py-2 text-left font-medium">상품명</th>
                      <th className="px-4 py-2 text-right font-medium">수량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.lines.map((line) => (
                      <tr key={line.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2.5 text-left">{line.productName}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          {line.totalQuantity.toLocaleString()}
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
