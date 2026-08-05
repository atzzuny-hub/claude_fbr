import { z } from "zod";
import { countrySchema, listSearchParamsSchema } from "./common";
import { wmsLinkSyncStatusSchema } from "./status";

/**
 * WmsLink (WMS 연동) — 계층 최상위. WmsLink 1 : Client N.
 * managerEmail: 해외 WMS 담당자 연락처 — NEW 요청 제출 시 이메일 발송 대상
 * (PRD "해외 WMS 담당자에게 이메일 자동 발송" 흐름을 위해 설계 시 추가한 필드).
 */
export const wmsLinkSchema = z.object({
  id: z.string(),
  // 입고 목록 API(Swagger)의 wmsLinkId(int32)가 가리키는 수치 ID — 물류 행이 이 값으로
  // WMS LINK를 참조하고, 목록 필터 옵션 value도 이 값을 쓴다.
  // WMS 메뉴 자체 Swagger 확정 전 잠정 필드(확정 시 id와 통합 검토).
  idx: z.number().int(),
  name: z.string(), // 예: REVE VN (FEI)
  country: countrySchema,
  syncStatus: wmsLinkSyncStatusSchema,
  managerEmail: z.email(),
  createdAt: z.iso.datetime(),
});
export type WmsLink = z.infer<typeof wmsLinkSchema>;

/**
 * WMS LINK 필터 옵션 — GET /wmslkmap 응답 그대로(실서버 확인 2026-08-05: {name, idx} 배열,
 * Req 파라미터 없음). 목록 화면의 WMS LINK 필터가 쓰는 최소 형태로, WMS 메뉴의 wmsLinkSchema
 * (연동 관리용 상세 모델)와는 별개다.
 */
export const wmsLinkOptionSchema = z.object({
  name: z.string(),
  idx: z.number().int(),
});
export type WmsLinkOption = z.infer<typeof wmsLinkOptionSchema>;

export const wmsLinkSearchParamsSchema = listSearchParamsSchema.extend({
  country: countrySchema.optional(),
  status: wmsLinkSyncStatusSchema.optional(),
});
export type WmsLinkSearchParams = z.infer<typeof wmsLinkSearchParamsSchema>;

// WMS 등록/수정 폼 입력
export const wmsLinkInputSchema = z.object({
  name: z.string().min(1),
  country: countrySchema,
  managerEmail: z.email(),
  syncStatus: wmsLinkSyncStatusSchema.optional(),
});
export type WmsLinkInput = z.infer<typeof wmsLinkInputSchema>;
