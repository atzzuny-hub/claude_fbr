import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Undo2,
  Boxes,
  Tag,
  Mail,
  Link2,
  Users,
  UserCog,
  Factory,
} from "lucide-react";
import type { UserRole } from "@/types";

/**
 * 사이드바 메뉴 단일 출처 — CLAUDE.md "메뉴 ↔ 라우트 ↔ 타입 매핑" 표와 1:1.
 * 정산 메뉴는 이번 재구축 범위에서 제외되어 있으므로 포함하지 않는다.
 *
 * section:
 *  - "common"   : 공통 메뉴 — OPERATOR/CLIENT 모두 노출 (데이터는 서버에서 스코핑)
 *  - "operator" : 운영자 전용 메뉴 — CLIENT 세션에서는 아예 렌더링하지 않는다
 */
export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  section: "common" | "operator";
}

export const NAV_ITEMS: NavItem[] = [
  { key: "inbound", label: "입고현황", href: "/dtin", icon: ArrowDownToLine, section: "common" },
  { key: "outbound", label: "출고현황", href: "/outbound", icon: ArrowUpFromLine, section: "common" },
  { key: "returns", label: "반품현황", href: "/returns", icon: Undo2, section: "common" },
  { key: "inventory", label: "재고현황", href: "/inventory", icon: Boxes, section: "common" },
  { key: "sku", label: "SKU", href: "/sku", icon: Tag, section: "common" },
  { key: "requests", label: "NEW", href: "/requests", icon: Mail, section: "common" },
  { key: "wms", label: "WMS", href: "/wms", icon: Link2, section: "operator" },
  { key: "clients", label: "클라이언트", href: "/clients", icon: Users, section: "operator" },
  { key: "users", label: "사용자", href: "/users", icon: UserCog, section: "operator" },
  { key: "vendors", label: "업체관리", href: "/vendors", icon: Factory, section: "operator" },
];

export const NAV_SECTION_LABEL: Record<NavItem["section"], string> = {
  common: "공통 메뉴",
  operator: "운영자 전용",
};

/**
 * 역할 기반 메뉴 필터 — CLIENT는 section: "operator" 항목 자체를 받지 않는다
 * (CLAUDE.md: "운영자 전용 메뉴는 클라이언트 로그인 시 노출되지 않음").
 */
export function getNavItemsForRole(role: UserRole): NavItem[] {
  if (role === "OPERATOR") return NAV_ITEMS;
  return NAV_ITEMS.filter((item) => item.section === "common");
}

/** 현재 pathname과 매칭되는 nav item 탐색 (헤더 브레드크럼 등에서 사용) */
export function findNavItemByPathname(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
