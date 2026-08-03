import { cn } from "@/lib/utils";
import { formatDate, formatEpochDate, formatEpochTime, formatTime } from "@/lib/utils/datetime";

interface DateTimeCellProps {
  /**
   * ISO 날짜시간 문자열 또는 UTC epoch 밀리초(입고처럼 Swagger가 epoch로 주는 도메인).
   * 값이 없으면(아직 일어나지 않은 단계) fallback만 표시한다.
   */
  value: string | number | null | undefined;
  fallback?: string;
  className?: string;
}

/**
 * 목록 셀의 날짜시간 표기 — 날짜를 위, 시각을 아래 줄에 작게 둔다.
 * 한 줄("2026-06-13 14:20")로 쓰면 날짜 열마다 폭이 100px 이상 늘어 8열 표가 1440px에서
 * 가로 스크롤을 만든다. 행 높이에는 여유가 있으므로 세로로 쌓아 열 폭을 날짜 기준으로 유지한다.
 * 시각은 보조 정보이므로 한 단 작고 조용하게 둔다.
 */
export function DateTimeCell({ value, fallback = "-", className }: DateTimeCellProps) {
  if (value == null || value === "") {
    return <span className={cn("text-tertiary-foreground", className)}>{fallback}</span>;
  }
  const isEpoch = typeof value === "number";
  const date = isEpoch ? formatEpochDate(value) : formatDate(value);
  const time = isEpoch ? formatEpochTime(value) : formatTime(value);
  return (
    <span className={cn("flex min-w-0 flex-col leading-tight tabular-nums", className)}>
      {/* 열 폭이 좁아지면 날짜·시각 각 줄을 …으로 줄인다(고정 폭 표에서만 실제로 잘린다) */}
      <span className="truncate">{date}</span>
      {time && <span className="truncate text-xs text-muted-foreground">{time}</span>}
    </span>
  );
}
