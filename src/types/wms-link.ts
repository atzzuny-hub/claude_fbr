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
  name: z.string(), // 예: REVE VN (FEI)
  country: countrySchema,
  syncStatus: wmsLinkSyncStatusSchema,
  managerEmail: z.email(),
  createdAt: z.iso.datetime(),
});
export type WmsLink = z.infer<typeof wmsLinkSchema>;

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
