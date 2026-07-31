import type { Paginated, Vendor, VendorInput, VendorSearchParams } from "@/types";
import { mockVendors } from "@/lib/mock/vendors";
import { delay, matchesKeyword, paginate } from "./utils";

/**
 * Vendor (업체관리) — 운영자 전용 메뉴(F011). 역할 스코핑 대상 아님(REVE 내부 자원).
 */
let vendors: Vendor[] = [...mockVendors];

export async function getVendors(params: VendorSearchParams = {}): Promise<Paginated<Vendor>> {
  await delay();
  const filtered = vendors.filter((vendor) => {
    if (params.type && vendor.type !== params.type) return false;
    if (!matchesKeyword(params.keyword, vendor.name, vendor.contact, vendor.address)) return false;
    return true;
  });
  return paginate(filtered, params.page, params.pageSize);
}

export async function getVendor(id: string): Promise<Vendor | null> {
  await delay();
  return vendors.find((vendor) => vendor.id === id) ?? null;
}

export async function createVendor(input: VendorInput): Promise<Vendor> {
  await delay();
  const newVendor: Vendor = {
    id: `vendor-${vendors.length + 1}`,
    name: input.name,
    type: input.type,
    contact: input.contact,
    address: input.address ?? null,
    createdAt: new Date().toISOString(),
  };
  vendors = [newVendor, ...vendors];
  return newVendor;
}

export async function updateVendor(id: string, input: Partial<VendorInput>): Promise<Vendor | null> {
  await delay();
  const index = vendors.findIndex((vendor) => vendor.id === id);
  if (index === -1) return null;
  const updated: Vendor = { ...vendors[index], ...input };
  vendors = vendors.map((vendor, i) => (i === index ? updated : vendor));
  return updated;
}
