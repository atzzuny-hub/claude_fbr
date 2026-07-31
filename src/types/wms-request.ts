import { z } from "zod";
import { baseSearchParamsSchema, countrySchema } from "./common";
import { wmsRequestStatusSchema, wmsRequestTypeSchema } from "./status";

/**
 * WmsRequest (NEW 요청) — 클라이언트 소유 + 물류 모델 → clientId, country, wmsLinkId 필수.
 * relatedInboundId: 등록 완료(REGISTERED) 후 입고성격 요청이 입고현황에 "예정"으로
 * 반영되는 PRD 흐름(사용자 여정 3→4단계)을 목데이터에서 추적하기 위해 설계 시 추가한
 * 필드(PRD 데이터 모델 표에는 없음). 입고 외 요청 유형이거나 아직 등록 전이면 null.
 */
export const wmsRequestSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  clientName: z.string(),
  type: wmsRequestTypeSchema,
  status: wmsRequestStatusSchema,
  country: countrySchema,
  wmsLinkId: z.string(),
  wmsLinkName: z.string(),
  referenceNo: z.string(),
  itemCount: z.number().int().positive(), // 요청 항목 수
  attachmentUrl: z.string().nullable(), // 엑셀 업로드 첨부 파일
  memo: z.string().nullable(),
  relatedInboundId: z.string().nullable(),
  submittedAt: z.iso.datetime(),
  registeredAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type WmsRequest = z.infer<typeof wmsRequestSchema>;

export const wmsRequestSearchParamsSchema = baseSearchParamsSchema.extend({
  status: wmsRequestStatusSchema.optional(),
  type: wmsRequestTypeSchema.optional(),
  clientId: z.string().optional(),
  country: countrySchema.optional(),
});
export type WmsRequestSearchParams = z.infer<typeof wmsRequestSearchParamsSchema>;

// 요청 제출 입력 — 직접 입력/엑셀 업로드 공통 (업로드 시 attachmentUrl에 저장된 파일 참조)
export const wmsRequestInputSchema = z.object({
  clientId: z.string(),
  type: wmsRequestTypeSchema,
  wmsLinkId: z.string(),
  itemCount: z.number().int().positive(),
  attachmentUrl: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
});
export type WmsRequestInput = z.infer<typeof wmsRequestInputSchema>;
