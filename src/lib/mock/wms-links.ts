import type { WmsLink } from "@/types";

/**
 * WmsLink 목데이터 — 참조 무결성 최상위(가장 먼저 정의).
 * 현행 명칭을 참고한 6개 WMS LINK, PH/MY/VN 국가 혼합, 연동 상태 다양화.
 */
export const mockWmsLinks: WmsLink[] = [
  {
    id: "wms-1",
    name: "REVE VN (FEI)",
    country: "VN",
    syncStatus: "CONNECTED",
    managerEmail: "fei.manager@reve-vn-wms.example.com",
    createdAt: "2025-01-10T09:00:00Z",
  },
  {
    id: "wms-2",
    name: "PH Pharma Research",
    country: "PH",
    syncStatus: "CONNECTED",
    managerEmail: "ops@ph-pharma-research.example.com",
    createdAt: "2025-02-05T09:00:00Z",
  },
  {
    id: "wms-3",
    name: "MY Pharma Research",
    country: "MY",
    syncStatus: "CONNECTED",
    managerEmail: "ops@my-pharma-research.example.com",
    createdAt: "2025-02-05T09:00:00Z",
  },
  {
    id: "wms-4",
    name: "PH Torriden (SHP)",
    country: "PH",
    syncStatus: "PENDING",
    managerEmail: "shp.contact@torriden-ph-wms.example.com",
    createdAt: "2025-11-20T09:00:00Z",
  },
  {
    id: "wms-5",
    name: "REVE MY (WLH)",
    country: "MY",
    syncStatus: "CONNECTED",
    managerEmail: "wlh.contact@reve-my-wms.example.com",
    createdAt: "2025-05-14T09:00:00Z",
  },
  {
    id: "wms-6",
    name: "VN Cosmetics Hub (DHL)",
    country: "VN",
    syncStatus: "DISCONNECTED",
    managerEmail: "dhl.contact@vn-cosmetics-hub.example.com",
    createdAt: "2025-08-01T09:00:00Z",
  },
];
