import { z } from "zod";
import { baseSearchParamsSchema, countrySchema } from "./common";
import { inboundStatusSchema } from "./status";

/**
 * Inbound (입고) — 클라이언트 소유 + 물류 모델 → clientId, country, wmsLinkId 필수.
 */
export const inboundSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  clientName: z.string(),
  skuId: z.string(),
  skuCode: z.string(),
  skuName: z.string(),
  country: countrySchema,
  wmsLinkId: z.string(),
  wmsLinkName: z.string(),
  status: inboundStatusSchema,
  referenceNo: z.string(),
  quantity: z.number().int().nonnegative(),
  expectedDate: z.iso.date(), // 입고 예정일 (기준일자 후보)
  receivedDate: z.iso.date().nullable(), // 실제 입고 완료일 (RECEIVED 전에는 null)
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Inbound = z.infer<typeof inboundSchema>;

export const inboundSearchParamsSchema = baseSearchParamsSchema.extend({
  status: inboundStatusSchema.optional(),
  clientId: z.string().optional(),
  country: countrySchema.optional(),
});
export type InboundSearchParams = z.infer<typeof inboundSearchParamsSchema>;
