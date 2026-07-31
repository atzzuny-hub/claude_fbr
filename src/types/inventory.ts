import { z } from "zod";
import { baseSearchParamsSchema, countrySchema } from "./common";

/**
 * InventoryItem (재고) — 클라이언트 소유 + 물류 모델 → clientId, country, wmsLinkId 필수.
 * 상태(enum) 없이 수량 기반 조회 화면이라 status 필터는 두지 않는다.
 */
export const inventoryItemSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  clientName: z.string(),
  skuId: z.string(),
  skuCode: z.string(),
  skuName: z.string(),
  country: countrySchema,
  wmsLinkId: z.string(),
  wmsLinkName: z.string(),
  quantity: z.number().int().nonnegative(), // 총 재고
  availableQuantity: z.number().int().nonnegative(), // 가용 재고
  allocatedQuantity: z.number().int().nonnegative(), // 할당(출고예정) 재고
  updatedAt: z.iso.datetime(), // 재고 기준 시각 (기준일자 후보)
});
export type InventoryItem = z.infer<typeof inventoryItemSchema>;

export const inventorySearchParamsSchema = baseSearchParamsSchema.extend({
  clientId: z.string().optional(),
  country: countrySchema.optional(),
});
export type InventorySearchParams = z.infer<typeof inventorySearchParamsSchema>;
