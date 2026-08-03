"use client";

import { useId, useLayoutEffect, useMemo, useState } from "react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { buildQueryString } from "@/lib/utils/search-params";
import { toDateInputValue } from "@/lib/utils/datetime";
import type { UserRole } from "@/types";

/** select 전체 옵션 sentinel — "" 값은 Base UI Select item과 충돌해 별도 문자열을 쓴다 */
const ALL = "ALL";

/** 기간 필드 초기값의 폭(일) — 종료는 오늘, 시작은 오늘로부터 이 일수만큼 전. */
const DEFAULT_PERIOD_DAYS = 7;

/**
 * 기간 초기값 — 시작 = (오늘-1주) 00:00, 종료 = 오늘 23:59 (datetime-local 값 형식).
 * 기간은 날짜+시:분 단위로 검색한다(입고 목록 Req의 startDt/endDt 정밀도와 동일).
 */
function defaultPeriod(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - DEFAULT_PERIOD_DAYS);
  return { from: `${toDateInputValue(from)}T00:00`, to: `${toDateInputValue(today)}T23:59` };
}

/**
 * URL로 들어온 기간 값을 datetime-local 입력 형식("YYYY-MM-DDTHH:mm")으로 정규화한다.
 * 과거 URL/북마크의 날짜만 있는 값은 시작 00:00 / 종료 23:59로 채운다 — 그대로 넣으면
 * datetime-local 입력이 형식 불일치로 값을 버려 빈칸으로 보인다(필터는 걸린 채로).
 */
function toDateTimeLocalValue(value: string | undefined, endOfDay: boolean): string {
  if (!value) return "";
  return value.length === 10 ? `${value}T${endOfDay ? "23:59" : "00:00"}` : value.slice(0, 16);
}

/**
 * 검색 컨트롤 공통 높이(40px) — 라벨이 보더에 걸치는 구조라 기본 h-8보다 한 단 크게 둔다.
 * `data-[size=default]:h-10`을 함께 주는 이유: SelectTrigger가 내부에 가진
 * `data-[size=default]:h-8`은 속성 선택자를 포함해 특이성이 더 높아 평범한 `h-10`으로는
 * 덮이지 않는다(twMerge가 같은 modifier끼리 정리해 h-8 쪽만 제거된다).
 */
const CONTROL_CLASS = "h-10 data-[size=default]:h-10";
/** 아이콘 전용 버튼(초기화) — 위 컨트롤 높이와 같은 정사각 */
const CONTROL_CLASS_SQUARE = "size-8";

/** "전체"(sentinel) 옵션을 앞에 붙인 목록 — Select.Root의 items와 SelectContent가 같은 배열을 쓴다 */
function withAllOption(options: SelectOption[]): SelectOption[] {
  return [{ value: ALL, label: "전체" }, ...options];
}

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
  /** WMS LINK select 옵션 — getWmsLinks() 결과를 페이지(서버)에서 매핑해 전달. 미지정 시 필드 숨김 */
  wmsLinkOptions?: SelectOption[];
  /** 기준일자 select 옵션 — 도메인별 날짜 필드(예: 입고=입고예정일/입고일). 비어 있으면 필드 숨김 */
  dateFieldOptions: SelectOption[];
  /** 상태 select 옵션 — *_STATUS_LABEL에서 매핑. 미지정 시 상태 select 자체를 숨긴다(재고현황 등) */
  statusOptions?: SelectOption[];
  /**
   * 상태 select의 표시 라벨(선택) — 기본 "상태".
   * 화면마다 상태의 이름이 다르므로(입고현황=입고상태) 목록의 상태 컬럼명과 같은 값을 넘긴다.
   */
  statusLabel?: string;
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
 * F012 검색 패널 — 기간(시작일/종료일)·기준일자·WMS LINK·상태·검색어 + 초기화(아이콘)/조회.
 * 값 형태는 BaseSearchParams(@/types/common)와 1:1 대응한다.
 * 기간 초기값은 최근 1주(시작일 = 오늘-7일, 종료일 = 오늘) — URL에 값이 없을 때만 채워지고,
 * 초기화 버튼도 빈값이 아니라 이 초기값으로 되돌린다. 조회를 눌러야 목록에 적용된다.
 * 도메인 옵션(wmsLinkOptions/dateFieldOptions/statusOptions/clientOptions/countryOptions)은
 * 전부 props 주입 — 이 컴포넌트는 어떤 도메인 상태값도 하드코딩하지 않는다.
 *
 * 필드 구성은 화면마다 다르다: select 필터는 **옵션을 넘긴 것만 렌더링**하므로, 페이지가 넘기는
 * props가 곧 그 화면의 검색 조건이다(예: 입고현황 = WMS LINK·시작일·종료일·기준일자·검색어).
 * 기간·검색어는 현재 모든 목록 화면이 공통으로 쓰므로 항상 노출한다 — 특정 화면에서 빼야 하면
 * 여기에 플래그 prop을 추가한다.
 * 렌더링하지 않는 필터는 조회 시 쿼리에도 싣지 않는다(아래 has* 플래그) — URL에 남아 있던 값이
 * 화면에 보이지 않는 조건으로 계속 따라붙는 것을 막는다.
 */
export function SearchPanel({
  basePath,
  role,
  wmsLinkOptions,
  dateFieldOptions,
  statusOptions,
  statusLabel = "상태",
  clientOptions,
  countryOptions,
  keywordPlaceholder,
  defaultValues,
  onSearch,
  className,
}: SearchPanelProps) {
  const router = useRouter();
  const isOperator = role === "OPERATOR";
  /** 라벨 ↔ 컨트롤 연결용 id 프리픽스 — 한 화면에 패널이 둘 이상 있어도 id가 겹치지 않는다 */
  const uid = useId();

  const [dateFrom, setDateFrom] = useState(toDateTimeLocalValue(defaultValues?.dateFrom, false));
  const [dateTo, setDateTo] = useState(toDateTimeLocalValue(defaultValues?.dateTo, true));
  const [dateField, setDateField] = useState(defaultValues?.dateField ?? dateFieldOptions[0]?.value ?? "");
  const [wmsLinkId, setWmsLinkId] = useState(defaultValues?.wmsLinkId ?? ALL);
  const [status, setStatus] = useState(defaultValues?.status ?? ALL);
  const [clientId, setClientId] = useState(defaultValues?.clientId ?? ALL);
  const [country, setCountry] = useState(defaultValues?.country ?? ALL);
  const [keyword, setKeyword] = useState(defaultValues?.keyword ?? "");

  /*
   * 기간 초기값(시작일 = 오늘-1주, 종료일 = 오늘) 채우기.
   * 렌더 중에 new Date()로 계산하지 않는 이유: 이 컴포넌트는 SSR도 거치므로 서버와 브라우저의
   * 시간대가 다르면(예: UTC 서버 배포) "오늘"이 서로 달라 hydration이 어긋난다 — 마운트 후
   * 브라우저 로컬 기준으로 한 번만 채운다. URL에 기간이 이미 있으면(조회한 화면 새로고침·
   * 링크 공유 등) 그 값이 우선이므로 건드리지 않는다.
   */
  useLayoutEffect(() => {
    if (defaultValues?.dateFrom || defaultValues?.dateTo) return;
    const period = defaultPeriod();
    // 시계(외부 시스템)에서 읽어 오는 클라이언트 전용 초기값이라 마운트 직후 1회의 추가 렌더가
    // 의도된 비용이다 — set-state-in-effect 규칙이 권하는 "외부 → 상태 동기화"가 정확히 이 경우.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDateFrom(period.from);
    setDateTo(period.to);
    // 마운트 1회만 — 이후 defaultValues가 바뀌는 경우는 조회로 URL이 바뀔 때뿐이라(상태가 이미
    // 최신) 다시 적용할 일이 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WMS LINK 1 : 클라이언트 N — WMS 선택 시 그 WMS 소속 클라이언트로만 옵션을 좁힌다.
  const scopedClientOptions = useMemo(() => {
    if (!clientOptions) return [];
    if (wmsLinkId === ALL) return clientOptions;
    return clientOptions.filter((option) => option.wmsLinkId === wmsLinkId);
  }, [clientOptions, wmsLinkId]);

  // 어떤 필터를 렌더링할지 = 페이지가 그 옵션을 넘겼는지. JSX 조건과 쿼리 구성이 같은 값을 본다.
  const hasWmsFilter = (wmsLinkOptions?.length ?? 0) > 0;
  const hasDateFieldFilter = dateFieldOptions.length > 0;
  const hasStatusFilter = (statusOptions?.length ?? 0) > 0;
  const hasClientFilter = isOperator && clientOptions !== undefined;
  const hasCountryFilter = isOperator && (countryOptions?.length ?? 0) > 0;

  // 아래 items는 Select.Root에도 넘긴다 — 그래야 트리거가 원시 value("ALL") 대신 라벨("전체")을 렌더한다.
  const wmsItems = useMemo(() => withAllOption(wmsLinkOptions ?? []), [wmsLinkOptions]);
  const statusItems = useMemo(() => withAllOption(statusOptions ?? []), [statusOptions]);
  const clientItems = useMemo(() => withAllOption(scopedClientOptions), [scopedClientOptions]);
  const countryItems = useMemo(() => withAllOption(countryOptions ?? []), [countryOptions]);

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
      dateField: hasDateFieldFilter ? dateField || undefined : undefined,
      wmsLinkId: hasWmsFilter && wmsLinkId !== ALL ? wmsLinkId : undefined,
      status: hasStatusFilter && status !== ALL ? status : undefined,
      clientId: hasClientFilter && clientId !== ALL ? clientId : undefined,
      country: hasCountryFilter && country !== ALL ? country : undefined,
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
    // 기간은 빈값이 아니라 초기값(오늘-1주 ~ 오늘)으로 복원한다 — 첫 진입 상태와 동일하게.
    const period = defaultPeriod();
    setDateFrom(period.from);
    setDateTo(period.to);
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
      <div className="flex flex-wrap items-end gap-x-3 gap-y-5">
        {hasWmsFilter && (
          <Field label="WMS LINK" htmlFor={`${uid}-wms`}>
            <Select
              items={wmsItems}
              value={wmsLinkId}
              onValueChange={(value) => handleWmsLinkChange(value as string)}
            >
              <SelectTrigger id={`${uid}-wms`} className={cn(CONTROL_CLASS, "w-44")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {wmsItems.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {/* 기간은 시작일/종료일 각각 독립 필드 — 필드마다 라벨이 자기 보더에 걸리는 구조라
         * 두 인풋을 하나의 "기간" 라벨로 묶지 않는다.
         * datetime-local: 기간을 날짜+시:분 단위로 검색한다(입고 Req의 startDt/endDt 정밀도). */}
        <Field label="시작일" htmlFor={`${uid}-date-from`}>
          <Input
            id={`${uid}-date-from`}
            type="datetime-local"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className={cn(CONTROL_CLASS, "w-44")}
          />
        </Field>

        <Field label="종료일" htmlFor={`${uid}-date-to`}>
          <Input
            id={`${uid}-date-to`}
            type="datetime-local"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className={cn(CONTROL_CLASS, "w-44")}
          />
        </Field>

        {hasDateFieldFilter && (
          <Field label="기준일자" htmlFor={`${uid}-date-field`}>
            <Select
              items={dateFieldOptions}
              value={dateField}
              onValueChange={(value) => setDateField(value as string)}
            >
              <SelectTrigger id={`${uid}-date-field`} className={cn(CONTROL_CLASS, "w-44")}>
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

        {hasStatusFilter && (
          <Field label={statusLabel} htmlFor={`${uid}-status`}>
            <Select
              items={statusItems}
              value={status}
              onValueChange={(value) => setStatus(value as string)}
            >
              <SelectTrigger id={`${uid}-status`} className={cn(CONTROL_CLASS, "w-44")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusItems.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {/* 클라이언트 select는 OPERATOR에게만 렌더링 — CLIENT는 세션으로 자동 스코핑되어 이 UI 자체가 없다 */}
        {hasClientFilter && (
          <Field label="클라이언트" htmlFor={`${uid}-client`}>
            <Select
              items={clientItems}
              value={clientId}
              onValueChange={(value) => setClientId(value as string)}
            >
              <SelectTrigger id={`${uid}-client`} className={cn(CONTROL_CLASS, "w-44")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clientItems.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {hasCountryFilter && (
          <Field label="국가" htmlFor={`${uid}-country`}>
            <Select
              items={countryItems}
              value={country}
              onValueChange={(value) => setCountry(value as string)}
            >
              <SelectTrigger id={`${uid}-country`} className={cn(CONTROL_CLASS, "w-44")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {countryItems.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field label="검색어" htmlFor={`${uid}-keyword`} className="w-44">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary-foreground"
            aria-hidden="true"
          />
          <Input
            id={`${uid}-keyword`}
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={keywordPlaceholder ?? "검색어를 입력하세요"}
            className={cn(CONTROL_CLASS, "pl-9")}
          />
        </Field>

        {/* ml-auto — 필드가 여러 줄로 감길 때 버튼 묶음은 항상 줄 오른쪽 끝에 붙는다 */}
        <div className="ml-auto flex items-center gap-2">
          {/* 초기화는 아이콘 전용(레이블 없음) — 텍스트가 없으므로 aria-label + 툴팁으로 이름을 준다 */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="link"
                  size="icon"
                  aria-label="초기화"
                  onClick={handleReset}
                  className={CONTROL_CLASS_SQUARE}
                />
              }
            >
              <RotateCcw aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>초기화</TooltipContent>
          </Tooltip>
          <Button onClick={handleSearch} className={CONTROL_CLASS}>
            {/* <Search data-icon="inline-start" /> */}
            조회
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * 검색 필드 한 칸 — 라벨을 컨트롤 보더 위에 걸쳐 놓는다(노치 라벨).
 * 라벨 배경 `bg-card`는 패널 서피스와 같은 색이어야 보더가 라벨 뒤에서 끊겨 보인다 —
 * 패널 배경을 바꾸면 이 값도 같이 바꿔야 한다.
 * htmlFor로 컨트롤 id와 묶어 라벨 클릭 시 포커스가 이동하고 스크린리더에도 이름이 전달된다.
 */
function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Label
        htmlFor={htmlFor}
        className="absolute top-0 left-2.5 z-10 -translate-y-1/2 bg-card px-1 text-[11px] leading-none font-medium text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}
