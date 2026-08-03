import type { Paginated, WmsLink, WmsLinkInput, WmsLinkSearchParams } from "@/types";
import { mockWmsLinks } from "@/lib/mock/wms-links";
import { delay, matchesKeyword, paginate } from "./utils";

/**
 * WmsLink (WMS) — 운영자 전용 메뉴. 역할 스코핑 대상 아님(전 화면 동일 데이터).
 * 뮤테이션은 모듈 스코프 배열에 반영 — 새로고침 시 초기화(Phase 1 한정, 문제 없음).
 */
let wmsLinks: WmsLink[] = [...mockWmsLinks];

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
