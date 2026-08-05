import { redirect } from "next/navigation";
import { wmsLinkOptionSchema, type Paginated, type WmsLink, type WmsLinkInput, type WmsLinkOption, type WmsLinkSearchParams } from "@/types";
import { WMS_API } from "@/lib/api";
import { ApiError, getJavaApi } from "@/lib/api/server";
import { mockWmsLinks } from "@/lib/mock/wms-links";
import { requireAccessToken } from "./session";
import { delay, matchesKeyword, paginate } from "./utils";

/**
 * WmsLink (WMS) — 운영자 전용 메뉴. 역할 스코핑 대상 아님(전 화면 동일 데이터).
 * 뮤테이션은 모듈 스코프 배열에 반영 — 새로고침 시 초기화(Phase 1 한정, 문제 없음).
 * WMS 메뉴 자체는 아직 목이고, 목록 화면 필터용 getWmsLinkOptions만 실 API가 있다(아래).
 */
let wmsLinks: WmsLink[] = [...mockWmsLinks];

/**
 * 목록 화면의 WMS LINK 필터 옵션 — GET /wmslkmap(확정, 사용자 제공 2026-08-05).
 * DATA_SOURCE=api일 때만 실 호출(입고와 같은 도메인별 전환 스위치 컨벤션), 그 외에는
 * 목 WMS 목록에서 {idx, name}만 추린다. 응답은 name 오름차순으로 이미 정렬돼 온다(실측).
 */
export async function getWmsLinkOptions(): Promise<WmsLinkOption[]> {
  if (process.env.DATA_SOURCE !== "api") {
    await delay();
    return wmsLinks.map(({ idx, name }) => ({ idx, name }));
  }
  const accessToken = await requireAccessToken();
  const res = await getJavaApi(WMS_API.linkMap, { accessToken });
  // 401 = 리프레시까지 만료된 드문 경우 — 입고(readJavaJson)와 동일하게 로그인으로 보낸다.
  if (res?.status === 401) redirect("/login");
  if (!res || !res.ok) {
    const body = res ? await res.text().catch(() => "") : "";
    console.error(
      `[lib/data/wms-links] GET /wmslkmap 실패: ${res ? `HTTP ${res.status}` : "네트워크 연결 불가"}${body ? ` — ${body.slice(0, 500)}` : ""}`,
    );
    throw new ApiError(res?.status ?? 502, "WMS LINK 목록을 불러오지 못했습니다.");
  }
  const json = await res.json().catch(() => null);
  const parsed = wmsLinkOptionSchema.array().safeParse(json);
  if (!parsed.success) {
    console.error("[lib/data/wms-links] GET /wmslkmap 응답 형식이 다릅니다:", json, parsed.error.issues);
    throw new ApiError(502, "WMS LINK 목록 응답 형식이 올바르지 않습니다.");
  }
  return parsed.data;
}

export async function getWmsLinks(params: WmsLinkSearchParams = {}): Promise<Paginated<WmsLink>> {
  await delay();
  const filtered = wmsLinks.filter((link) => {
    if (params.country && link.country !== params.country) return false;
    if (params.status && link.syncStatus !== params.status) return false;
    if (!matchesKeyword(params.keyword, link.name, link.managerEmail)) return false;
    return true;
  });
  return paginate(filtered, params.page, params.pageSize);
}

export async function getWmsLink(id: string): Promise<WmsLink | null> {
  await delay();
  return wmsLinks.find((link) => link.id === id) ?? null;
}

export async function createWmsLink(input: WmsLinkInput): Promise<WmsLink> {
  await delay();
  // 수치 ID(idx)는 실제로는 서버가 발급 — 목에서는 현재 최댓값 + 1로 흉내 낸다.
  const nextIdx = wmsLinks.reduce((max, link) => Math.max(max, link.idx), 0) + 1;
  const newLink: WmsLink = {
    id: `wms-${nextIdx}`,
    idx: nextIdx,
    name: input.name,
    country: input.country,
    syncStatus: input.syncStatus ?? "PENDING",
    managerEmail: input.managerEmail,
    createdAt: new Date().toISOString(),
  };
  wmsLinks = [newLink, ...wmsLinks];
  return newLink;
}

export async function updateWmsLink(id: string, input: Partial<WmsLinkInput>): Promise<WmsLink | null> {
  await delay();
  const index = wmsLinks.findIndex((link) => link.id === id);
  if (index === -1) return null;
  const updated: WmsLink = { ...wmsLinks[index], ...input };
  wmsLinks = wmsLinks.map((link, i) => (i === index ? updated : link));
  return updated;
}
