import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderBreadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  /**
   * 목록 건수 — 지정 시 타이틀 옆에 "제목 (건수)" 형태로 표시한다(템플릿 §4.2 "목록명 (건수)").
   * 데이터 계약 변경 없이 화면 조립 단계가 선택적으로 넘기는 값(예: 조회 결과 total).
   */
  count?: number;
  /** 페이지 내부 보조 브레드크럼 — 헤더(AppShell)의 전역 "REVE / 메뉴명"과는 별개, 선택 사용 */
  breadcrumbs?: PageHeaderBreadcrumb[];
  /** 우측 액션 슬롯 — 예: "SKU 등록", "WMS 등록" 버튼, ExcelDownloadButton */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * 목록/관리 화면 상단 공통 헤더 — 타이틀 + (선택) 브레드크럼/설명/건수 + 우측 액션 슬롯.
 * 도메인 비의존: 텍스트와 액션 노드를 모두 props로 주입받는다.
 *
 * 설명(description)은 타이틀 아래가 아니라 오른쪽에 베이스라인을 맞춰 붙는다(레퍼런스 이미지):
 * 한 줄짜리 보조 설명이라 세로 공간을 따로 쓰지 않고, 좁은 화면에서는 자연히 다음 줄로 넘어간다.
 */
export function PageHeader({
  title,
  description,
  count,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-border pb-4",
        className,
      )}
    >
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="breadcrumb" className="mb-1 flex items-center gap-1 text-xs text-tertiary-foreground">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="size-3" aria-hidden="true" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {/* text-xl = 1.25rem — 요청한 1.2rem에 맞는 Tailwind 타입 스케일 값(임의값 대신 스케일 유지) */}
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
            {title}
            {typeof count === "number" && (
              <span className="ml-1.5 align-middle text-base font-semibold text-tertiary-foreground">
                ({count.toLocaleString()})
              </span>
            )}
          </h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
