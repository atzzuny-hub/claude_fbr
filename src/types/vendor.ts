import { z } from "zod";
import { listSearchParamsSchema } from "./common";

/**
 * Vendor (업체) — 클라이언트 소유 모델이 아니므로 clientId 없음(협력사는 REVE 내부 자원).
 * type은 PRD 데이터 모델 표에 string으로 명시되어 있어 zod enum이 아닌 자유 문자열로 둔다.
 */
export const vendorSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(), // 예: 택배사, 포장재 공급업체, 창고운영사, 라벨 인쇄업체, 통관업체
  contact: z.string(),
  address: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type Vendor = z.infer<typeof vendorSchema>;

export const vendorSearchParamsSchema = listSearchParamsSchema.extend({
  type: z.string().optional(),
});
export type VendorSearchParams = z.infer<typeof vendorSearchParamsSchema>;

export const vendorInputSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  contact: z.string().min(1),
  address: z.string().nullable().optional(),
});
export type VendorInput = z.infer<typeof vendorInputSchema>;
