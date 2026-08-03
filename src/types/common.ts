import { z } from "zod";

/**
 * 공통 타입 — 모든 도메인이 참조하는 단일 출처.
 * zod 우선: 값이 실제로 검증되어야 하는 원시 타입은 zod 스키마로 정의하고
 * z.infer로 TS 타입을 파생한다.
 */

// ── 국가 ──────────────────────────────────────────────────────────
// 확장 가능하게 배열 기반으로 유지 (신규 진출국 추가 시 이 배열만 수정)
export const COUNTRY = ["PH", "MY", "VN"] as const;
export type Country = (typeof COUNTRY)[number];
export const countrySchema = z.enum(COUNTRY);

export const COUNTRY_LABEL: Record<Country, string> = {
  PH: "필리핀",
  MY: "말레이시아",
  VN: "베트남",
};

// ── 페이지네이션 ──────────────────────────────────────────────────
// 제네릭 응답 포맷이라 zod 스키마 대신 순수 TS 제네릭으로 정의한다.
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;

// ── 검색 패널 공통 파라미터 ────────────────────────────────────────
// F012 검색 패널 스펙(기간·기준일자·WMS LINK·검색어)과 1:1 대응.
// 입고현황/출고현황/반품현황/재고현황/SKU/NEW 6개 목록 화면에서 이 타입을 확장해
// status 등 도메인 전용 필터를 추가한다.
export const baseSearchParamsSchema = z.object({
  dateFrom: z.iso.date().optional(), // 기간 시작일
  dateTo: z.iso.date().optional(), // 기간 종료일
  dateField: z.string().optional(), // 기준일자 (필터 대상 날짜 필드명, 도메인별로 다름)
  wmsLinkId: z.string().optional(), // WMS LINK 필터
  keyword: z.string().optional(), // 검색어
  // 정렬: sort = 컬럼 키(도메인별 정렬 접근자가 해석, 모르는 키는 무시), order = 방향.
  // order에 잘못된 값이 와도 전체 파싱이 실패하지 않도록 catch로 흘려보낸다(정렬만 해제됨).
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional().catch(undefined),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).optional(),
});
export type BaseSearchParams = z.infer<typeof baseSearchParamsSchema>;

// WMS/클라이언트/사용자/업체관리 4개 운영자 전용 관리 화면은 F012(기간 검색) 대상이 아니므로
// 더 단순한 목록 검색 파라미터를 사용한다 (키워드 + 페이지네이션만 공통).
export const listSearchParamsSchema = z.object({
  keyword: z.string().optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).optional(),
});
export type ListSearchParams = z.infer<typeof listSearchParamsSchema>;
