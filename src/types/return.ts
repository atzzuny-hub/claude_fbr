import { z } from "zod";
import { baseSearchParamsSchema, countrySchema } from "./common";
import { returnStatusSchema } from "./status";

/**
 * Return (반품) — 클라이언트 소유 + 물류 모델 → clientId, country, wmsLinkId 필수.
 * 타입명은 CLAUDE.md 매핑 표(반품현황 → Return)를 그대로 따른다.
 */
export const returnSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  clientName: z.string(),
  skuId: z.string(),
  skuCode: z.string(),
  skuName: z.string(),
  country: countrySchema,
  wmsLinkId: z.string(),
  wmsLinkName: z.string(),
  status: returnStatusSchema,
  referenceNo: z.string(),
  quantity: z.number().int().nonnegative(),
  reason: z.string(), // 반품 사유
  requestedDate: z.iso.date(), // 반품 접수일 (기준일자 후보)
  completedDate: z.iso.date().nullable(), // 처리 완료일 (COMPLETED 전에는 null)
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Return = z.infer<typeof returnSchema>;

export const returnSearchParamsSchema = baseSearchParamsSchema.extend({
  status: returnStatusSchema.optional(),
  clientId: z.string().optional(),
  country: countrySchema.optional(),
});
export type ReturnSearchParams = z.infer<typeof returnSearchParamsSchema>;
