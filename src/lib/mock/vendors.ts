import type { Vendor } from "@/types";
import { pad, pickDate, toDatetime } from "./seed-helpers";

/**
 * Vendor(업체) 목데이터 — 클라이언트 소유 모델이 아니므로 마스터 데이터 중 가장 마지막에
 * 두어도 무방하지만, 참조 무결성상 다른 목데이터와 독립적이라 이 파일만으로 완결된다.
 * 기본 업체 10곳 x 국가 3곳(PH/MY/VN) 조합으로 30건을 생성한다.
 */

const BASE_VENDORS: { name: string; type: string }[] = [
  { name: "J&T Express", type: "택배사" },
  { name: "Ninja Van", type: "택배사" },
  { name: "Flash Express", type: "택배사" },
  { name: "Green Pack Supply", type: "포장재 공급업체" },
  { name: "EcoBox Materials", type: "포장재 공급업체" },
  { name: "Regional Warehouse Ops", type: "창고운영사" },
  { name: "LabelWorks Asia", type: "라벨 인쇄업체" },
  { name: "Asia Customs Broker", type: "통관업체" },
  { name: "QC Partners Asia", type: "품질검수업체" },
  { name: "SEA Freight Solutions", type: "운송업체" },
];

const COUNTRY_INFO: { code: string; city: string; dial: string }[] = [
  { code: "PH", city: "Manila, Philippines", dial: "+63-2-8000" },
  { code: "MY", city: "Kuala Lumpur, Malaysia", dial: "+60-3-2000" },
  { code: "VN", city: "Ho Chi Minh City, Vietnam", dial: "+84-28-3000" },
];

export const mockVendors: Vendor[] = BASE_VENDORS.flatMap((base, baseIndex) =>
  COUNTRY_INFO.map((country, countryIndex) => {
    const seedIndex = baseIndex * COUNTRY_INFO.length + countryIndex;
    const createdDate = pickDate(seedIndex, 8);

    const vendor: Vendor = {
      id: `vendor-${pad(seedIndex + 1, 2)}`,
      name: `${base.name} (${country.code})`,
      type: base.type,
      contact: `${country.dial}-${pad(seedIndex + 1, 4)}`,
      address: country.city,
      createdAt: toDatetime(createdDate, "09:00:00"),
    };
    return vendor;
  }),
);
