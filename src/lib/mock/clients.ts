import type { Client } from "@/types";
import { mockWmsLinks } from "./wms-links";

/**
 * Client(마켓) 목데이터 — WmsLink 다음으로 정의(참조 무결성 순서).
 * WmsLink 1 : Client N 계층에 따라 각 WMS LINK 소속 마켓 2~4개씩 배정.
 * country는 소속 WmsLink의 country를 그대로 표시용으로 상속한다.
 */

function wmsLinkOf(id: string) {
  const link = mockWmsLinks.find((w) => w.id === id);
  if (!link) throw new Error(`unknown wmsLinkId: ${id}`);
  return link;
}

const wms1 = wmsLinkOf("wms-1"); // REVE VN (FEI)
const wms2 = wmsLinkOf("wms-2"); // PH Pharma Research
const wms3 = wmsLinkOf("wms-3"); // MY Pharma Research
const wms4 = wmsLinkOf("wms-4"); // PH Torriden (SHP)
const wms5 = wmsLinkOf("wms-5"); // REVE MY (WLH)
const wms6 = wmsLinkOf("wms-6"); // VN Cosmetics Hub (DHL)

export const mockClients: Client[] = [
  // wms-1 REVE VN (FEI) — VN
  { id: "client-01", name: "Torriden VN", wmsLinkId: wms1.id, wmsLinkName: wms1.name, country: wms1.country, status: "ACTIVE", createdAt: "2025-01-15T09:00:00Z" },
  { id: "client-02", name: "Anua VN", wmsLinkId: wms1.id, wmsLinkName: wms1.name, country: wms1.country, status: "ACTIVE", createdAt: "2025-01-20T09:00:00Z" },
  { id: "client-03", name: "Mediheal VN", wmsLinkId: wms1.id, wmsLinkName: wms1.name, country: wms1.country, status: "ACTIVE", createdAt: "2025-02-01T09:00:00Z" },
  { id: "client-04", name: "COSRX VN", wmsLinkId: wms1.id, wmsLinkName: wms1.name, country: wms1.country, status: "INACTIVE", createdAt: "2025-02-10T09:00:00Z" },

  // wms-2 PH Pharma Research — PH
  { id: "client-05", name: "Anua PH", wmsLinkId: wms2.id, wmsLinkName: wms2.name, country: wms2.country, status: "ACTIVE", createdAt: "2025-02-12T09:00:00Z" },
  { id: "client-06", name: "Some By Mi PH", wmsLinkId: wms2.id, wmsLinkName: wms2.name, country: wms2.country, status: "ACTIVE", createdAt: "2025-02-14T09:00:00Z" },
  { id: "client-07", name: "Mediheal PH", wmsLinkId: wms2.id, wmsLinkName: wms2.name, country: wms2.country, status: "ACTIVE", createdAt: "2025-02-18T09:00:00Z" },

  // wms-3 MY Pharma Research — MY
  { id: "client-08", name: "Anua MY", wmsLinkId: wms3.id, wmsLinkName: wms3.name, country: wms3.country, status: "ACTIVE", createdAt: "2025-02-20T09:00:00Z" },
  { id: "client-09", name: "COSRX MY", wmsLinkId: wms3.id, wmsLinkName: wms3.name, country: wms3.country, status: "ACTIVE", createdAt: "2025-02-22T09:00:00Z" },
  { id: "client-10", name: "Mediheal MY", wmsLinkId: wms3.id, wmsLinkName: wms3.name, country: wms3.country, status: "ACTIVE", createdAt: "2025-03-01T09:00:00Z" },

  // wms-4 PH Torriden (SHP) — PH
  { id: "client-11", name: "Torriden PH", wmsLinkId: wms4.id, wmsLinkName: wms4.name, country: wms4.country, status: "ACTIVE", createdAt: "2025-11-25T09:00:00Z" },
  { id: "client-12", name: "Torriden PH Duty Free", wmsLinkId: wms4.id, wmsLinkName: wms4.name, country: wms4.country, status: "ACTIVE", createdAt: "2025-11-28T09:00:00Z" },
  { id: "client-13", name: "Torriden PH Marketplace", wmsLinkId: wms4.id, wmsLinkName: wms4.name, country: wms4.country, status: "INACTIVE", createdAt: "2025-12-02T09:00:00Z" },
  { id: "client-14", name: "Round Lab PH", wmsLinkId: wms4.id, wmsLinkName: wms4.name, country: wms4.country, status: "ACTIVE", createdAt: "2025-12-05T09:00:00Z" },

  // wms-5 REVE MY (WLH) — MY
  { id: "client-15", name: "Torriden MY", wmsLinkId: wms5.id, wmsLinkName: wms5.name, country: wms5.country, status: "ACTIVE", createdAt: "2025-05-20T09:00:00Z" },
  { id: "client-16", name: "Round Lab MY", wmsLinkId: wms5.id, wmsLinkName: wms5.name, country: wms5.country, status: "ACTIVE", createdAt: "2025-05-25T09:00:00Z" },
  { id: "client-17", name: "Numbuzin MY", wmsLinkId: wms5.id, wmsLinkName: wms5.name, country: wms5.country, status: "ACTIVE", createdAt: "2025-06-01T09:00:00Z" },

  // wms-6 VN Cosmetics Hub (DHL) — VN
  { id: "client-18", name: "Numbuzin VN", wmsLinkId: wms6.id, wmsLinkName: wms6.name, country: wms6.country, status: "ACTIVE", createdAt: "2025-08-10T09:00:00Z" },
  { id: "client-19", name: "Round Lab VN", wmsLinkId: wms6.id, wmsLinkName: wms6.name, country: wms6.country, status: "ACTIVE", createdAt: "2025-08-15T09:00:00Z" },
  { id: "client-20", name: "Some By Mi VN", wmsLinkId: wms6.id, wmsLinkName: wms6.name, country: wms6.country, status: "INACTIVE", createdAt: "2025-08-20T09:00:00Z" },
];
