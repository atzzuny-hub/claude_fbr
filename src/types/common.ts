import { z } from "zod";

/**
 * 공통 타입 — 모든 도메인이 참조하는 단일 출처.
 * zod 우선: 값이 실제로 검증되어야 하는 원시 타입은 zod 스키마로 정의하고
 * z.infer로 TS 타입을 파생한다.
 */

// ── 국가 ──────────────────────────────────────────────────────────
// 확장 가능하게 배열 기반으로 유지 (신규 진출국 추가 시 이 배열만 수정)
// SG: 실서버 입고 데이터로 확인되어 추가(실측 2026-08-05)
export const COUNTRY = ["PH", "MY", "VN", "SG"] as const;
export type Country = (typeof COUNTRY)[number];
export const countrySchema = z.enum(COUNTRY);

export const COUNTRY_LABEL: Record<Country, string> = {
  PH: "필리핀",
  MY: "말레이시아",
  VN: "베트남",
  SG: "싱가포르",
};

/**
 * 국가 표시명 — 아는 국가는 한글명, 모르는 코드는 코드 그대로 돌려준다.
 * 실데이터에 문서 밖 국가가 등장한 전례(SG) 때문에, 목록 표시 경로는 모르는 국가로
 * 화면이 깨지지 않게 이 폴백을 쓴다(COUNTRY_LABEL 직접 인덱싱은 확정 Country일 때만).
 */
export function countryLabel(code: string): string {
  return COUNTRY_LABEL[code as Country] ?? code;
}

// ── 와이어(Res 원문) 정규화 공통 헬퍼 ─────────────────────────────
// 실서버 와이어의 공통 특성(입고에서 실측 확정 2026-08-05, 같은 Java 관례라 도메인 공유):
// 날짜는 epoch "초" · 값 없음 = 0, 문자열은 null과 ""가 섞여 온다. 각 도메인의
// toDomain* 변환(types/inbound.ts·outbound.ts)이 이 헬퍼로 ms·null로 통일한다.

/** epoch 초 → ms. 0 = 값 없음(실측: 미도래 단계) → null. */
export function wireEpochToMs(sec: number | null): number | null {
  return sec ? sec * 1000 : null;
}

/** 빈 문자열도 값 없음 → null. 와이어는 없는 문자열을 null과 ""로 섞어 준다(실측 —
 * 같은 필드가 행에 따라 null이기도 ""이기도 하다). 화면의 대시 폴백(?? "—")이 한 가지
 * 경우(null)만 보게 여기서 통일한다. */
export function wireTextToNull(text: string | null): string | null {
  return text && text.trim() !== "" ? text : null;
}

// ── Java API 공통 에러 바디 ────────────────────────────────────────
// 프로브로 확인(2026-08-04, GET /dtin 무토큰 401 응답): 에러는 { code, data, message }
// 래핑이 아니라 아래 형태다. errorCode(예: "1003" = 액세스 토큰 오류)가 판별 키.
// 성공 응답의 전역 래핑 여부는 여전히 미확인(CLAUDE.md TBD) — 실 토큰 호출로 확정한다.
export const javaApiErrorSchema = z.object({
  timestamp: z.string().optional(),
  path: z.string().optional(),
  status: z.number().optional(),
  error: z.string().optional(),
  requestId: z.string().optional(),
  errorCode: z.string().optional(),
});
export type JavaApiError = z.infer<typeof javaApiErrorSchema>;

/**
 * errorCode 카탈로그 — 레거시 프런트(useAjax.ts)에서 확인(2026-08-04).
 * 주의: LOGIN_FAILED(1006)는 HTTP 500으로 온다(401 아님) — BFF가 자격증명 오류로 정규화.
 * 1018/1023은 레거시 주석상 둘 다 "제품관리 중복 등록" 계열 — 구분 의미는 확인 필요.
 */
export const JAVA_API_ERROR_CODE = {
  /** 액세스 토큰 오류(만료·위조) — 데이터 API 401에 동반 */
  INVALID_ACCESS_TOKEN: "1003",
  /** 로그인 실패(이메일 또는 비밀번호 오류) — HTTP 500 */
  LOGIN_FAILED: "1006",
  /** 비밀번호 변경 시 기존 비밀번호 불일치 — HTTP 401 */
  CURRENT_PASSWORD_MISMATCH: "1009",
  /** 제품관리 중복 등록(A) */
  DUPLICATE_PRODUCT_A: "1018",
  /** 제품관리 중복 등록(B) */
  DUPLICATE_PRODUCT_B: "1023",
  /** WMS API 연동 실패(인증 정보 오류) */
  WMS_API_AUTH_FAILED: "1050",
} as const;

// ── 페이지네이션 ──────────────────────────────────────────────────
// 제네릭 응답 포맷이라 zod 스키마 대신 순수 TS 제네릭으로 정의한다.
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGE = 1;
// 목록 기본 표시 건수 — 사용자 확정값(선택지 100/200/300/500 중 기본 500).
// 화면·lib/data 모두 이 상수를 참조한다(하드코딩 금지).
export const DEFAULT_PAGE_SIZE = 500;

// ── 검색 패널 공통 파라미터 ────────────────────────────────────────
// F012 검색 패널 스펙(기간·기준일자·WMS LINK·검색어)과 1:1 대응.
// 입고현황/출고현황/반품현황/재고현황/SKU/NEW 6개 목록 화면에서 이 타입을 확장해
// status 등 도메인 전용 필터를 추가한다.
// 기간 경계값 — 검색 패널은 날짜만("2026-07-28", type=date) 보내고(사용자 확정),
// 과거 URL/북마크의 날짜+시:분 값("2026-07-28T00:00")도 계속 허용한다. 날짜만 있는 값은
// 시작일 00:00 · 종료일 23:59로 해석한다(lib/data/utils.withinDateTimeRange — Req의
// startDt/endDt가 날짜+시:분 정밀도인 것과의 매핑도 같은 규칙).
const dateBoundSchema = z.union([z.iso.datetime({ local: true }), z.iso.date()]);

export const baseSearchParamsSchema = z.object({
  dateFrom: dateBoundSchema.optional(), // 기간 시작(날짜+시:분)
  dateTo: dateBoundSchema.optional(), // 기간 종료(날짜+시:분)
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
