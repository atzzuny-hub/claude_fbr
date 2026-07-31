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
    <div className={cn("mb-5 flex flex-wrap items-start justify-between gap-3", className)}>
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
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          {title}
          {typeof count === "number" && (
            <span className="ml-1.5 align-middle text-lg font-semibold text-tertiary-foreground">
              ({count.toLocaleString()})
            </span>
          )}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
