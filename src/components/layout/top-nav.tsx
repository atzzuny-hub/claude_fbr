"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNavItemsForRole, type NavItem } from "./nav-items";

interface TopNavProps {
  role: UserRole;
}

/** 항목 사이 gap(px) — 아래 시각 요소의 `gap-1`(0.25rem)과 반드시 일치해야 폭 계산이 맞는다 */
const GAP_PX = 4;
/** "더보기" 트리거 실측에 실패했을 때(레이아웃 이전 등) 쓰는 보수적 폴백 폭 */
const FALLBACK_MORE_WIDTH = 84;

const navLinkClass =
  "relative flex h-full shrink-0 items-center whitespace-nowrap px-3 text-sm font-medium text-header-foreground/70 outline-none transition-colors hover:text-header-foreground focus-visible:text-header-foreground";
const navLinkActiveClass = "text-header-foreground font-semibold";
const navUnderlineClass =
  "pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-header-foreground";
const moreTriggerClass = cn(navLinkClass, "cursor-pointer gap-1 data-popup-open:text-header-foreground");

/**
 * 글로벌 탑메뉴 — 인디고 헤더 안에서 메뉴를 가로로 나열한다(솔루션 디자인 템플릿 §4.1,
 * "상단바: 로고 | 글로벌 메뉴(활성=언더라인/볼드)").
 * NAV_ITEMS는 lucide 아이콘(컴포넌트 참조)을 포함해 서버→클라이언트 props로 직렬화할 수
 * 없으므로, role(순수 문자열)만 받아 이 컴포넌트(클라이언트) 안에서 직접 필터링한다.
 *
 * 오버플로 처리(우선순위 내비게이션 패턴): 화면에 보이지 않는 측정용 목록(measureRef)에
 * 전체 항목을 동일한 스타일로 렌더링해 실제 폭을 재고, 가용 폭(containerRef)에 맞는 개수만
 * 노출한 뒤 나머지는 "더보기" 드롭다운으로 격리한다. 컨테이너 폭이 바뀔 때마다(ResizeObserver)
 * 재계산해 가로 스크롤 없이 내비 영역 안에서만 오버플로를 흡수한다.
 */
export function TopNav({ role }: TopNavProps) {
  const pathname = usePathname();
  const items = getNavItemsForRole(role);

  const containerRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);
  const moreMeasureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  const isActive = useCallback(
    (item: NavItem) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    [pathname],
  );

  const recalc = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const containerWidth = container.clientWidth;
    const widths = Array.from(measure.children).map((el) => (el as HTMLElement).offsetWidth);
    const moreWidth = moreMeasureRef.current?.offsetWidth ?? FALLBACK_MORE_WIDTH;

    const cumulative: number[] = [];
    widths.reduce((acc, w, i) => {
      const next = acc + w + (i > 0 ? GAP_PX : 0);
      cumulative.push(next);
      return next;
    }, 0);

    const totalWidth = cumulative.at(-1) ?? 0;
    if (totalWidth <= containerWidth) {
      setVisibleCount(widths.length);
      return;
    }

    const budget = containerWidth - moreWidth - GAP_PX;
    let count = 0;
    for (let i = 0; i < cumulative.length; i++) {
      if (cumulative[i] <= budget) {
        count = i + 1;
      } else {
        break;
      }
    }
    setVisibleCount(count);
  }, []);

  useLayoutEffect(() => {
    recalc();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => recalc());
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recalc, items.length]);

  const visibleItems = items.slice(0, visibleCount);
  const overflowItems = items.slice(visibleCount);
  const overflowActive = overflowItems.some(isActive);

  return (
    <nav
      ref={containerRef}
      aria-label="글로벌 메뉴"
      className="relative flex h-full min-w-0 flex-1 items-center overflow-hidden"
    >
      {/* 측정 전용 — 화면에는 보이지 않지만(레이아웃 흐름 밖) 실제 렌더 폭을 재는 데 쓴다 */}
      <ul
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute top-0 left-0 flex items-center gap-1"
      >
        {items.map((item) => (
          <li key={item.key} className={navLinkClass}>
            {item.label}
          </li>
        ))}
      </ul>
      <div
        ref={moreMeasureRef}
        aria-hidden="true"
        className={cn("pointer-events-none invisible absolute top-0 left-0", moreTriggerClass)}
      >
        더보기
        <ChevronDown className="size-3.5" />
      </div>

      <ul className="flex h-full min-w-0 items-center gap-1 overflow-x-auto">
        {visibleItems.map((item, index) => {
          const active = isActive(item);
          const prevSection = visibleItems[index - 1]?.section;
          const showDivider = prevSection !== undefined && prevSection !== item.section;
          return (
            <li key={item.key} className="flex h-full shrink-0 items-center">
              {showDivider && (
                <span className="mr-1 h-4 w-px shrink-0 bg-white/20" aria-hidden="true" />
              )}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(navLinkClass, active && navLinkActiveClass)}
              >
                {item.label}
                {active && <span className={navUnderlineClass} aria-hidden="true" />}
              </Link>
            </li>
          );
        })}
      </ul>

      {overflowItems.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(moreTriggerClass, overflowActive && navLinkActiveClass)}>
            더보기
            <ChevronDown className="size-3.5" aria-hidden="true" />
            {overflowActive && <span className={navUnderlineClass} aria-hidden="true" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {overflowItems.map((item) => {
              const active = isActive(item);
              return (
                <DropdownMenuItem
                  key={item.key}
                  render={<Link href={item.href} />}
                  className={cn(active && "bg-accent text-accent-foreground")}
                >
                  {item.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </nav>
  );
}
