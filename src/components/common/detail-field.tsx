import { cn } from "@/lib/utils";

/**
 * 상세 팝업/화면의 항목 하나 — 라벨(dt) + 읽기 전용 값(dd)을 입력창 모양 박스로 보여 준다.
 * 수정 화면이 아니라 조회 화면이므로 실제 input을 쓰지 않는다(폼 시맨틱 없이 값만 노출).
 * dt/dd 시맨틱이라 <dl>(보통 grid 컬럼) 안에서 쓴다 — 사용 예: 입고 상세 팝업.
 * 값 없음의 대시("—") 등 빈 값 표기는 호출부 몫이다(value는 표시할 문자열로 확정해 넘긴다).
 */
export function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="text-xs text-tertiary-foreground">{label}</dt>
      <dd
        className={cn(
          "truncate rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground",
          mono && "font-mono tabular-nums",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
