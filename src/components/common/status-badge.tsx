import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * 상태 뱃지 — 라벨은 반드시 호출부가 types/status.ts의 *_LABEL 맵에서 뽑아 주입한다
 * (이 컴포넌트는 한글 상태명을 알지 못한다). tone은 브랜드색과 분리된 시맨틱 신호색으로,
 * 도메인별 상태 코드 → tone 매핑 역시 호출부(화면 조립 단계)의 책임이다.
 *
 * 리브온 솔루션 디자인 템플릿(§5.2): 소프트 배경 + 컬러 텍스트의 필(pill) 배지 —
 * 버튼(할 일)과 시각적으로 반드시 구분되도록 진한 채움색은 쓰지 않는다.
 *
 * 권장 매핑 예시(참고용, 강제 아님):
 *  - neutral    : 대기, 임시저장, 비활성 등 중립 상태
 *  - info       : 제출됨, 예정 등 "시작" 단계
 *  - warning    : 대기, 준비중, 검수중, WMS 등록 대기, 연동대기 등 "진행중" 단계
 *  - success    : 입고, 출고완료, 완료, 등록 완료, 활성, 연동 등 "완료" 단계
 *  - destructive: 비활성, 연동해제 등 부정적 상태
 */
const statusBadgeVariants = cva(
  "inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        info: "bg-info-bg text-info",
        warning: "bg-warning-bg text-warning",
        success: "bg-success-bg text-success",
        destructive: "bg-danger-bg text-danger",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  label: string;
  className?: string;
}

export function StatusBadge({ label, tone, className }: StatusBadgeProps) {
  return <span className={cn(statusBadgeVariants({ tone }), className)}>{label}</span>;
}
