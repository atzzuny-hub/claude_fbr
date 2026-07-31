import { z } from "zod";
import { countrySchema, listSearchParamsSchema } from "./common";
import { clientStatusSchema } from "./status";

/**
 * Client (클라이언트/마켓) — WmsLink 1 : Client N.
 * country는 WmsLink 속성을 표시용으로 상속(동기화 시점에 함께 내려온다고 가정).
 * 수기 생성 불가(WMS 연동 동기화 전용) — lib/data에도 create 함수를 두지 않는다.
 */
export const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
  wmsLinkId: z.string(),
  wmsLinkName: z.string(), // 표시용 비정규화 필드
  country: countrySchema,
  status: clientStatusSchema,
  createdAt: z.iso.datetime(),
});
export type Client = z.infer<typeof clientSchema>;

export const clientSearchParamsSchema = listSearchParamsSchema.extend({
  wmsLinkId: z.string().optional(),
  country: countrySchema.optional(),
  status: clientStatusSchema.optional(),
});
export type ClientSearchParams = z.infer<typeof clientSearchParamsSchema>;

// 상태 변경(활성/비활성)만 지원 — 필드 편집은 WMS 동기화 전용이라 미제공
export const clientStatusUpdateSchema = z.object({
  status: clientStatusSchema,
});
export type ClientStatusUpdate = z.infer<typeof clientStatusUpdateSchema>;
