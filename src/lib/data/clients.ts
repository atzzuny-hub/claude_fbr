import type { Client, ClientSearchParams, ClientStatusUpdate, Paginated } from "@/types";
import { mockClients } from "@/lib/mock/clients";
import { delay, matchesKeyword, paginate } from "./utils";

/**
 * Client (클라이언트/마켓) — 운영자 전용 메뉴. WMS 동기화 전용이라
 * create 함수는 두지 않는다(PRD "수기 생성 불가").
 */
let clients: Client[] = [...mockClients];

export async function getClients(params: ClientSearchParams = {}): Promise<Paginated<Client>> {
  await delay();
  const filtered = clients.filter((client) => {
    if (params.wmsLinkId && client.wmsLinkId !== params.wmsLinkId) return false;
    if (params.country && client.country !== params.country) return false;
    if (params.status && client.status !== params.status) return false;
    if (!matchesKeyword(params.keyword, client.name, client.wmsLinkName)) return false;
    return true;
  });
  return paginate(filtered, params.page, params.pageSize);
}

export async function getClient(id: string): Promise<Client | null> {
  await delay();
  return clients.find((client) => client.id === id) ?? null;
}

// 클라이언트 상태 관리(활성/비활성)만 지원 — 필드 편집은 WMS 동기화 전용
export async function updateClientStatus(id: string, input: ClientStatusUpdate): Promise<Client | null> {
  await delay();
  const index = clients.findIndex((client) => client.id === id);
  if (index === -1) return null;
  const updated: Client = { ...clients[index], status: input.status };
  clients = clients.map((client, i) => (i === index ? updated : client));
  return updated;
}
