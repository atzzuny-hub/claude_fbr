"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { buildQueryString } from "@/lib/utils/search-params";
import type { UserRole } from "@/types";

/** select 전체 옵션 sentinel — "" 값은 Base UI Select item과 충돌해 별도 문자열을 쓴다 */
const ALL = "ALL";

export interface SelectOption {
  value: string;
  label: string;
}

export interface ClientFilterOption extends SelectOption {
  wmsLinkId: string;
}

export interface SearchPanelValues {
  dateFrom?: string;
  dateTo?: string;
  dateField?: string;
  wmsLinkId?: string;
  status?: string;
  clientId?: string;
  country?: string;
  keyword?: string;
}

export interface SearchPanelProps {
  /** 조회 시 router.push할 목록 화면 경로 (예: "/inbound") */
  basePath: string;
  /** 세션 role — OPERATOR만 클라이언트/국가 select를 렌더링한다(CLIENT는 자동 스코핑) */
  role: UserRole;
  /** WMS LINK select 옵션 — getWmsLinks() 결과를 페이지(서버)에서 매핑해 전달 */
  wmsLinkOptions: SelectOption[];
  /** 기준일자 select 옵션 — 도메인별 날짜 필드(예: 입고=입고예정일/입고일). 비어 있으면 필드 숨김 */
  dateFieldOptions: SelectOption[];
  /** 상태 select 옵션 — *_STATUS_LABEL에서 매핑. 미지정 시 상태 select 자체를 숨긴다(재고현황 등) */
  statusOptions?: SelectOption[];
  /** 클라이언트 select 옵션(OPERATOR 전용) — wmsLinkId 포함, WMS 선택 시 이 값 기준으로 좁혀진다 */
  clientOptions?: ClientFilterOption[];
  /** 국가 select 옵션(OPERATOR 전용, 선택) — 미지정 시 필드 숨김 */
  countryOptions?: SelectOption[];
  keywordPlaceholder?: string;
  /** 새로고침/뒤로가기 시에도 값이 유지되도록, 페이지가 읽은 현재 searchParams를 그대로 주입 */
  defaultValues?: SearchPanelValues;
  /** router.push 외에 추가로 실행할 콜백(선택) — 값은 "전체" 선택 시 undefined로 정규화되어 전달 */
  onSearch?: (query: SearchPanelValues) => void;
  className?: string;
}

/**
 * F012 검색 패널 — 기간(시작일/종료일)·기준일자·WMS LINK·상태·검색어 + 조회/초기화.
 * 값 형태는 BaseSearchParams(@/types/common)와 1:1 대응한다.
 * 도메인 옵션(dateFieldOptions/statusOptions/clientOptions/countryOptions)은 전부 props 주입 —
 * 이 컴포넌트는 어떤 도메인 상태값도 하드코딩하지 않는다.
 */
export function SearchPanel({
  basePath,
  role,
  wmsLinkOptions,
  dateFieldOptions,
  statusOptions,
  clientOptions,
  countryOptions,
  keywordPlaceholder,
  defaultValues,
  onSearch,
  className,
}: SearchPanelProps) {
  const router = useRouter();
  const isOperator = role === "OPERATOR";

  const [dateFrom, setDateFrom] = useState(defaultValues?.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(defaultValues?.dateTo ?? "");
  const [dateField, setDateField] = useState(defaultValues?.dateField ?? dateFieldOptions[0]?.value ?? "");
  const [wmsLinkId, setWmsLinkId] = useState(defaultValues?.wmsLinkId ?? ALL);
  const [status, setStatus] = useState(defaultValues?.status ?? ALL);
  const [clientId, setClientId] = useState(defaultValues?.clientId ?? ALL);
  const [country, setCountry] = useState(defaultValues?.country ?? ALL);
  const [keyword, setKeyword] = useState(defaultValues?.keyword ?? "");

  // WMS LINK 1 : 클라이언트 N — WMS 선택 시 그 WMS 소속 클라이언트로만 옵션을 좁힌다.
  const scopedClientOptions = useMemo(() => {
    if (!clientOptions) return [];
    if (wmsLinkId === ALL) return clientOptions;
    return clientOptions.filter((option) => option.wmsLinkId === wmsLinkId);
  }, [clientOptions, wmsLinkId]);

  function handleWmsLinkChange(value: string) {
    setWmsLinkId(value);
    const stillValid = value === ALL || (clientOptions ?? []).some(
      (option) => option.wmsLinkId === value && option.value === clientId,
    );
    if (!stillValid) setClientId(ALL);
  }

  function resolveValues(): SearchPanelValues {
    return {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      dateField: dateField || undefined,
      wmsLinkId: wmsLinkId === ALL ? undefined : wmsLinkId,
      status: status === ALL ? undefined : status,
      clientId: isOperator && clientId !== ALL ? clientId : undefined,
      country: isOperator && country !== ALL ? country : undefined,
      keyword: keyword.trim() || undefined,
    };
  }

  function handleSearch() {
    const values = resolveValues();
    const qs = buildQueryString({ ...values, page: 1 });
    router.push(qs ? `${basePath}?${qs}` : basePath);
    onSearch?.(values);
  }

  function handleReset() {
    setDateFrom("");
    setDateTo("");
    setDateField(dateFieldOptions[0]?.value ?? "");
    setWmsLinkId(ALL);
    setStatus(ALL);
    setClientId(ALL);
    setCountry(ALL);
    setKeyword("");
    router.push(basePath);
    onSearch?.({});
  }

  return (
    <div
      className={cn(
        "rounded-2xl bg-card p-4 shadow-[0_8px_24px_rgba(30,20,80,0.06)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-end gap-4">
        <Field label="기간">
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-[8.5rem]"
              aria-label="시작일"
            />
            <span className="text-muted-foreground">~</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-[8.5rem]"
              aria-label="종료일"
            />
          </div>
        </Field>

        {dateFieldOptions.length > 0 && (
          <Field label="기준일자">
            <Select value={dateField} onValueChange={(value) => setDateField(value as string)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateFieldOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field label="WMS LINK">
          <Select value={wmsLinkId} onValueChange={(value) => handleWmsLinkChange(value as string)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>전체</SelectItem>
              {wmsLinkOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {statusOptions && statusOptions.length > 0 && (
          <Field label="상태">
            <Select value={status} onValueChange={(value) => setStatus(value as string)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>전체</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {/* 클라이언트 select는 OPERATOR에게만 렌더링 — CLIENT는 세션으로 자동 스코핑되어 이 UI 자체가 없다 */}
        {isOperator && clientOptions && (
          <Field label="클라이언트">
            <Select value={clientId} onValueChange={(value) => setClientId(value as string)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>전체</SelectItem>
                {scopedClientOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {isOperator && countryOptions && countryOptions.length > 0 && (
          <Field label="국가">
            <Select value={country} onValueChange={(value) => setCountry(value as string)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>전체</SelectItem>
                {countryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field label="검색어" className="min-w-48 flex-1">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-tertiary-foreground"
              aria-hidden="true"
            />
            <Input
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={keywordPlaceholder ?? "검색어를 입력하세요"}
              className="pl-8"
            />
          </div>
        </Field>

        <div className="flex items-center gap-2">
          <Button onClick={handleSearch}>
            <Search data-icon="inline-start" />
            조회
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw data-icon="inline-start" />
            초기화
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
