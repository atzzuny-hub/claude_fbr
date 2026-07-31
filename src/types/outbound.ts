import { z } from "zod";
import { baseSearchParamsSchema, countrySchema } from "./common";
import { outboundStatusSchema } from "./status";

/**
 * Outbound (출고) — 클라이언트 소유 + 물류 모델 → clientId, country, wmsLinkId 필수.
 */
export const outboundSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  clientName: z.string(),
  skuId: z.string(),
  skuCode: z.string(),
  skuName: z.string(),
  country: countrySchema,
  wmsLinkId: z.string(),
  wmsLinkName: z.string(),
  status: outboundStatusSchema,
  referenceNo: z.string(),
  quantity: z.number().int().nonnegative(),
  orderDate: z.iso.date(), // 출고 지시일 (기준일자 후보)
  shippedDate: z.iso.date().nullable(), // 실제 출고완료일 (SHIPPED 전에는 null)
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Outbound = z.infer<typeof outboundSchema>;

export const outboundSearchParamsSchema = baseSearchParamsSchema.extend({
  status: outboundStatusSchema.optional(),
  clientId: z.string().optional(),
  country: countrySchema.optional(),
});
export type OutboundSearchParams = z.infer<typeof outboundSearchParamsSchema>;
