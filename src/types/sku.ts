import { z } from "zod";
import { baseSearchParamsSchema, countrySchema } from "./common";

/**
 * Sku (상품) — 클라이언트 소유 모델이므로 clientId 필수.
 * ⚠️ 확인 필요(PRD 잠정 가정 유지): PRD 데이터 모델 표는 물류 모델(입고/출고/반품/재고)에만
 * country·wmsLinkId를 명시하고 Sku에는 포함하지 않았다. 이 잠정 가정을 그대로 따라
 * Sku 엔티티 자체에는 country/wmsLinkId 필드를 두지 않는다.
 * 다만 SKU 페이지도 F013(클라이언트·국가·WMS LINK 필터) 대상이므로, 검색 시에는
 * clientId를 경유해 소속 클라이언트의 country/wmsLinkId로 조인 필터링한다
 * (lib/data/skus.ts 참고). country가 SKU를 국가별로 분리 관리하는지는 여전히 확인 필요.
 */
export const skuSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  clientName: z.string(), // 표시용 비정규화 필드
  skuCode: z.string(),
  name: z.string(),
  category: z.string(),
  unit: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Sku = z.infer<typeof skuSchema>;

export const skuSearchParamsSchema = baseSearchParamsSchema.extend({
  clientId: z.string().optional(),
  country: countrySchema.optional(),
});
export type SkuSearchParams = z.infer<typeof skuSearchParamsSchema>;

export const skuInputSchema = z.object({
  clientId: z.string(),
  skuCode: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  unit: z.string().min(1),
});
export type SkuInput = z.infer<typeof skuInputSchema>;
