import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatusStep {
  key: string;
  /** 반드시 types/status.ts의 *_LABEL 맵에서 뽑아 주입 (예: INBOUND_STATUS_LABEL.SCHEDULED) */
  label: string;
}

export interface StatusStepperProps {
  steps: StatusStep[];
  /** 현재 위치한 단계의 key (예: INBOUND_STATUS 값 "WAITING") */
  currentKey: string;
  className?: string;
}

/**
 * 단계 진행 표시 — 입고(예정→대기→입고), NEW 요청(제출됨→WMS 등록 대기→등록 완료) 등
 * 순차 상태 흐름 전용. steps/currentKey는 도메인 상태 라벨 맵을 그대로 주입받는다.
 *
 * 리브온 솔루션 디자인 템플릿 톤: 완료=success(초록), 현재=primary(인디고), 미완료=중립(회색 보더).
 */
export function StatusStepper({ steps, currentKey, className }: StatusStepperProps) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === currentKey),
  );

  return (
    <ol className={cn("flex w-full items-start", className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === steps.length - 1;

        return (
          <li key={step.key} className={cn("flex items-center", !isLast && "flex-1")}>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  isCompleted && "border-success bg-success text-white",
                  isCurrent && "border-primary bg-primary text-primary-foreground",
                  !isCompleted && !isCurrent && "border-border bg-card text-tertiary-foreground",
                )}
              >
                {isCompleted ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
              </span>
              <span
                className={cn(
                  "max-w-20 text-center text-xs font-medium text-tertiary-foreground",
                  (isCompleted || isCurrent) && "text-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <span
                aria-hidden="true"
                className={cn(
                  "mx-2 h-0.5 flex-1 rounded-full",
                  index < currentIndex ? "bg-success" : "bg-border",
                )}
                style={{ marginBottom: "1.25rem" }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
