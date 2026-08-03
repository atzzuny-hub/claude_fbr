import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatusStep {
  key: string;
  /** 반드시 types/status.ts의 *_LABEL 맵에서 뽑아 주입 (예: INBOUND_STATUS_LABEL.SCHEDULED) */
  label: string;
  /** 라벨 위 보조 캡션(선택) — 예: "STEP 1". 상세 화면처럼 넓은 영역에서만 쓴다 */
  caption?: string;
  /** 라벨 뒤 보조 설명(선택) — 예: 그 단계에 해당하는 시점 이름("창고 도착") */
  description?: string;
}

export interface StatusStepperProps {
  steps: StatusStep[];
  /** 현재 위치한 단계의 key (예: INBOUND_STATUS 값 "WAITING") */
  currentKey: string;
  /**
   * 취소처럼 순차 파이프라인 밖의 종료 상태일 때 지정한다. 지정하면 진행 단계(steps) 대신
   * 붉은 X 단일 노드 하나만 그 라벨로 표시한다(입고·출고·반품 공통 취소 표현).
   */
  terminal?: { label: string };
  className?: string;
}

/**
 * 단계 진행 표시 — 입고(예정→대기→입고), NEW 요청(제출됨→WMS 등록 대기→등록 완료) 등
 * 순차 상태 흐름 전용. steps/currentKey는 도메인 상태 라벨 맵을 그대로 주입받는다.
 * 취소 등 파이프라인 밖 종료 상태는 terminal prop으로 붉은 X 단일 노드를 그린다.
 *
 * 리브온 솔루션 디자인 템플릿 톤: 완료=success(초록), 현재=primary(인디고), 미완료=중립(회색 보더).
 */
export function StatusStepper({ steps, currentKey, terminal, className }: StatusStepperProps) {
  // 취소 등 종료 상태 — 진행 단계 대신 붉은 X 단일 노드만 표시한다.
  if (terminal) {
    return (
      <ol className={cn("flex w-full items-start", className)}>
        <li className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-danger bg-danger-bg text-danger">
              <X className="size-3.5" aria-hidden="true" />
            </span>
            <span className="max-w-20 text-center text-xs font-medium text-danger">{terminal.label}</span>
          </div>
        </li>
      </ol>
    );
  }

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
                  // 설명이 붙으면 두 단어가 한 줄에 들어가도록 라벨 폭을 넓게 잡는다
                  "text-center text-xs font-medium text-tertiary-foreground",
                  step.description ? "max-w-32" : "max-w-20",
                  (isCompleted || isCurrent) && "text-foreground",
                )}
              >
                {step.caption && (
                  <span className="mb-0.5 block text-[0.6875rem] font-normal text-tertiary-foreground">
                    {step.caption}
                  </span>
                )}
                {step.label}
                {step.description && (
                  <span className="ml-1 font-normal text-tertiary-foreground">{step.description}</span>
                )}
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
