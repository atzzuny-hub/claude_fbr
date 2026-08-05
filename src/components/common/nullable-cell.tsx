import { cn } from "@/lib/utils";

interface NullableCellProps {
  /** 표시할 값 — 없으면(null/undefined/빈 문자열) fallback만 조용히 표시한다 */
  value: string | number | null | undefined;
  fallback?: string;
  className?: string;
}

/**
 * 목록 셀의 nullable 값 표기 — 접수번호처럼 행에 따라 비어 있을 수 있는 필드를
 * 값이 없을 때 조용한 대시(—)로 보여 준다(DateTimeCell·CountryCell과 같은 셀 헬퍼 계열).
 * 빈 문자열도 값 없음으로 본다 — 와이어 정규화(""→null)가 이미 막지만 방어적으로 동일 취급.
 */
export function NullableCell({ value, fallback = "—", className }: NullableCellProps) {
  if (value == null || value === "") {
    return <span className={cn("text-tertiary-foreground", className)}>{fallback}</span>;
  }
  return <span className={className}>{value}</span>;
}
