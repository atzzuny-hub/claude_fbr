"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Minus,
  Plus,
  RotateCcw,
  Rows3,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  /** 수량/참조번호 등 숫자성 데이터 — font-mono + tabular-nums 적용, 기본 우측 정렬 */
  numeric?: boolean;
  headerClassName?: string;
  cellClassName?: string;
  width?: string;
  /** 이 컬럼을 정렬 대상에서 제외한다(기본: onSortChange가 있으면 모든 컬럼 정렬 가능). */
  sortable?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  loading?: boolean;
  emptyMessage?: string;
  /**
   * 헤더 우측 경계를 드래그해 각 컬럼 너비를 조절할 수 있게 한다.
   * 켜면 표는 첫 렌더의 실제 컬럼 너비를 측정한 뒤 `table-layout: fixed`로 고정되고,
   * 이후 드래그로 바꾼 px 너비를 유지한다(넘치면 표 컨테이너가 가로 스크롤).
   */
  resizableColumns?: boolean;
  /**
   * 헤더 셀을 잡고 좌우로 드래그해 열 순서를 바꿀 수 있게 한다. 일정 거리 이상 움직여야
   * 드래그로 판정하므로 헤더 클릭 정렬과 공존한다(드래그로 끝난 조작의 정렬 클릭은 무시).
   * 툴바의 "열 순서 초기화" 버튼으로 화면 정의 순서로 되돌릴 수 있다.
   */
  reorderableColumns?: boolean;
  /**
   * 지정하면 사용자가 드래그로 바꾼 표 레이아웃(컬럼 너비·열 순서)을 이 키로 localStorage에
   * 저장해 다음 방문에도 복원한다. 표마다 고유한 값을 준다(예: "inbound").
   * 저장 대상은 UI 환경설정뿐 — 인증/세션 값은 저장하지 않는다.
   */
  persistKey?: string;
  /** 현재 정렬 중인 컬럼 key (없으면 정렬 없음). */
  sort?: string;
  /** 현재 정렬 방향. */
  order?: "asc" | "desc";
  /**
   * 정렬 가능한 헤더를 클릭했을 때 호출된다. 지정하면 각 컬럼 헤더가 클릭 가능해지고
   * (sortable: false 제외), 클릭할 때마다 오름 → 내림 → 해제 3단계로 순환한다.
   * order가 null이면 해제(정렬 없음) — 상위에서 URL의 sort/order를 제거하면 된다.
   * URL 쿼리 기반 정렬(페이지네이션과 동일 패턴)을 위해 상위에서 라우팅을 처리한다.
   */
  onSortChange?: (key: string, order: "asc" | "desc" | null) => void;
  /** 행 확장(+) 슬롯 — 지정 시 각 행 앞에 확장 토글이 생기고 펼치면 이 내용이 아래 행으로 붙는다 */
  renderDetail?: (row: T) => React.ReactNode;
  /** 행 단위 액션 슬롯 — 예: 행별 엑셀 다운로드 아이콘 */
  rowActions?: (row: T) => React.ReactNode;
  /**
   * 행을 클릭했을 때 호출된다(예: 상세 팝업 열기). 지정하면 행에 커서·포커스 링이 붙고
   * Enter/Space 키로도 열 수 있다. 행 앞 조작 칸(확장 토글·행 액션)의 클릭은 전달되지 않는다.
   */
  onRowClick?: (row: T) => void;
  /**
   * 표 상단 툴바(검색영역과 표 사이, 우측)에 놓을 화면별 액션 — 예: 검색결과 다운로드 버튼.
   * 공통 컴포넌트가 특정 부품에 의존하지 않도록 상위에서 렌더된 노드를 주입받는다.
   */
  toolbarActions?: React.ReactNode;
  /**
   * 남은 높이를 채우고 표 안에서만 스크롤한다(lg 이상). 헤더 행은 상단에 고정되고,
   * 페이지네이션은 스크롤 영역 밖에 남아 항상 보인다.
   * 이 모드를 쓰려면 부모가 높이가 정해진 flex 컬럼이어야 한다 — 아니면 표 영역이 0으로
   * 접힌다. lg 미만에서는 검색 조건이 여러 줄로 감겨 표에 남는 높이가 너무 얇아지므로
   * 평소처럼 페이지 전체가 스크롤된다.
   */
  fillHeight?: boolean;
  className?: string;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [100, 200, 300, 500];

/** 드래그로 줄일 수 있는 컬럼 최소 너비(px) */
const MIN_COLUMN_WIDTH = 48;

/**
 * 헤더 드래그를 열 순서 변경으로 판정하는 최소 이동 거리(px).
 * 그 미만의 잔움직임은 드래그로 보지 않아 헤더 클릭(정렬)이 평소처럼 동작한다.
 */
const REORDER_ACTIVATION_DISTANCE = 6;

/*
 * ── 행 가상화 상수 ────────────────────────────────────────────────
 * 표는 border-spacing-y-2(8px)로 행 사이 간격을 준다 — 가상화 계산에도 같은 간격을 알려 줘야
 * 스크롤 총 높이와 스페이서 높이가 실제 레이아웃과 어긋나지 않는다.
 */
const ROW_GAP_PX = 8;
/** 아직 측정되지 않은 본문 행의 높이 추정값 — 셀이 whitespace-nowrap이라 일반 행은 높이가 거의 균일하다. */
const ESTIMATED_ROW_HEIGHT = 68;
/** 행 확장(+) 상세는 내용에 따라 높이가 크게 달라 추정만 크게 잡고, 렌더 직후 실측으로 대체된다. */
const ESTIMATED_DETAIL_HEIGHT = 240;
/** 화면 밖에 미리 그려 둘 행 수 — 빠르게 스크롤해도 빈칸이 스치지 않게 하는 여유분 */
const ROW_OVERSCAN = 6;
/**
 * 서버 렌더(첫 HTML)에서 가정할 뷰포트 높이(px). 실제 높이는 마운트 직후 측정해 대체한다.
 * 이 값이 없으면 첫 HTML에 행이 하나도 담기지 않아 표가 잠깐 비어 보인다.
 */
const SSR_VIEWPORT_HEIGHT = 900;

/**
 * 이 요소가 실제로 스크롤되는 요소인지 — overflow 설정만 보면 안 되고(표 컨테이너는 가로
 * overflow 때문에 세로도 auto로 계산된다), 지금 내용이 넘쳐 스크롤이 생겼는지까지 봐야 한다.
 */
function isScrollable(element: HTMLElement) {
  const overflowY = window.getComputedStyle(element).overflowY;
  if (overflowY !== "auto" && overflowY !== "scroll" && overflowY !== "overlay") return false;
  return element.scrollHeight > element.clientHeight + 1;
}

/**
 * 가상화 단위 항목 — 본문 행 하나가 항목 하나이고, 펼쳐진 행은 상세 행이 바로 뒤에 하나 더 붙는다.
 * 실제 DOM(<tr> 2개)과 1:1로 맞춰 두면 높이 측정·스크롤 계산이 그대로 들어맞는다.
 */
interface RowEntry<T> {
  /** 측정 캐시 키 — 인덱스가 아니라 행 id 기준이라 행을 펼쳐 목록이 밀려도 캐시가 유지된다 */
  key: string;
  id: string;
  row: T;
  detail: boolean;
}

/** persistKey를 localStorage 키로 감싸는 네임스페이스 접두어 */
const WIDTHS_STORAGE_PREFIX = "reve:datatable:widths:";

/**
 * 저장된 컬럼 너비를 읽어 검증한다(숫자만·최소너비 클램프). 값이 없거나 손상되면 null.
 * 브라우저에서만 호출되므로(useLayoutEffect) window 접근은 안전하지만, 접근 실패(사파리 프라이빗 등)도 감싼다.
 */
function readStoredWidths(persistKey: string): Record<string, number> | null {
  try {
    const raw = window.localStorage.getItem(WIDTHS_STORAGE_PREFIX + persistKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        result[key] = Math.max(MIN_COLUMN_WIDTH, Math.round(value));
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

function writeStoredWidths(persistKey: string, widths: Record<string, number>) {
  try {
    window.localStorage.setItem(WIDTHS_STORAGE_PREFIX + persistKey, JSON.stringify(widths));
  } catch {
    // 저장 실패(용량 초과·프라이빗 모드 등)는 무시한다 — 너비 유지는 부가 기능일 뿐이다.
  }
}

function clearStoredWidths(persistKey: string) {
  try {
    window.localStorage.removeItem(WIDTHS_STORAGE_PREFIX + persistKey);
  } catch {
    // 무시 — 아래 재측정으로 화면은 기본 너비로 돌아간다.
  }
}

/** persistKey를 열 순서 localStorage 키로 감싸는 네임스페이스 접두어 */
const ORDER_STORAGE_PREFIX = "reve:datatable:order:";

/** 저장된 열 순서(컬럼 key 배열)를 읽어 검증한다. 값이 없거나 손상되면 null. */
function readStoredOrder(persistKey: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(ORDER_STORAGE_PREFIX + persistKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const keys = parsed.filter((value): value is string => typeof value === "string");
    return keys.length > 0 ? keys : null;
  } catch {
    return null;
  }
}

function writeStoredOrder(persistKey: string, order: string[]) {
  try {
    window.localStorage.setItem(ORDER_STORAGE_PREFIX + persistKey, JSON.stringify(order));
  } catch {
    // 저장 실패는 무시한다 — 순서 유지는 부가 기능일 뿐이다.
  }
}

function clearStoredOrder(persistKey: string) {
  try {
    window.localStorage.removeItem(ORDER_STORAGE_PREFIX + persistKey);
  } catch {
    // 무시 — 화면은 이미 기본 순서로 되돌린 뒤다.
  }
}

/**
 * 저장된 key 순서대로 컬럼을 재배열한다. 컬럼 구성이 바뀌어도 저장값이 깨지지 않게
 * 관대하게 병합한다 — 순서에 없는 새 컬럼은 화면 정의 순서대로 뒤에 붙고, 이미 사라진
 * key는 무시된다.
 */
function applyColumnOrder<T>(
  columns: DataTableColumn<T>[],
  order: string[] | null,
): DataTableColumn<T>[] {
  if (!order || order.length === 0) return columns;
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const result: DataTableColumn<T>[] = [];
  for (const key of order) {
    const column = byKey.get(key);
    if (column) {
      result.push(column);
      byKey.delete(key);
    }
  }
  for (const column of columns) {
    if (byKey.has(column.key)) result.push(column);
  }
  return result;
}

/*
 * 리브온 솔루션 디자인 템플릿(§2·§4.2) — "행 = 카드": 보더 격자 테이블 대신 여백·라운드·
 * 미세 섀도를 가진 카드형 행으로 표현한다.
 *
 * 구현 노트: 시맨틱은 그대로 <table>을 쓰되(접근성 유지), `border-spacing-x-0 / -y-2`로
 * 셀은 가로로 완전히 맞닿게(배경색이 이어져 seam 없이 하나의 바처럼 보임), 행 사이에만
 * 세로 간격을 준다. 첫/마지막 셀에만 좌/우 라운드를 줘 행 전체가 카드처럼 보이게 하고,
 * 섀도는 셀마다 box-shadow를 주는 대신 <tr>에 filter: drop-shadow(...)를 적용한다 —
 * box-shadow를 인접 셀마다 겹쳐 그리면 셀 경계에 이중 섀도 seam이 생기지만, drop-shadow는
 * 행 전체를 하나의 레이어로 합성한 뒤 그 실루엣에 그림자를 씌우므로 seam이 생기지 않는다.
 */
const ROW_SHADOW = "drop-shadow-[0_2px_6px_rgba(30,20,80,0.05)]";
const ROW_SHADOW_HOVER = "hover:drop-shadow-[0_6px_14px_rgba(30,20,80,0.08)]";
const ROW_SHADOW_SELECTED = "drop-shadow-[0_6px_16px_rgba(56,30,150,0.12)]";

export function DataTable<T>({
  columns,
  data,
  getRowId,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  loading = false,
  emptyMessage = "조회된 데이터가 없습니다.",
  resizableColumns = false,
  reorderableColumns = false,
  persistKey,
  sort,
  order,
  onSortChange,
  renderDetail,
  rowActions,
  onRowClick,
  toolbarActions,
  fillHeight = false,
  className,
}: DataTableProps<T>) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  /*
   * 페이지/페이지크기/검색조건이 바뀌어 새 목록이 그려지면 표 스크롤을 맨 위로 되돌린다.
   * 표 안에서만 스크롤되는 구조라 브라우저·Next의 "이동 시 맨 위로"가 이 컨테이너에는 닿지 않는다 —
   * 그대로 두면 아래까지 내려본 뒤 다음 페이지로 넘어갔을 때 새 페이지의 앞부분이 화면 위로 가려진다.
   * data를 의존성에 둔 이유: 서버에서 새 목록이 내려올 때만 배열 참조가 바뀌므로, 행 펼치기 같은
   * 내부 상태 변경으로는 스크롤이 튀지 않는다.
   */
  useLayoutEffect(() => {
    if (!fillHeight) return;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [fillHeight, page, pageSize, data]);

  /** 직전에 펼친 행 — 펼침 직후 그 상세를 화면 안으로 끌어오는 데만 쓴다 */
  const justOpenedRef = useRef<string | null>(null);

  function toggleRow(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        justOpenedRef.current = null;
      } else {
        next.add(id);
        justOpenedRef.current = id;
      }
      return next;
    });
  }

  /*
   * 스크롤 영역 아래쪽 행을 펼치면 상세가 잘린 경계 밖에 붙어, 눌렀는데 아무것도 안 나온 것처럼 보인다.
   * block: "nearest"라서 이미 보이는 상세는 건드리지 않고, 가려진 경우에만 최소한으로 끌어올린다.
   */
  useLayoutEffect(() => {
    const id = justOpenedRef.current;
    if (!fillHeight || !id) return;
    const detail = scrollRef.current?.querySelector(`[data-detail-row="${id}"]`);
    detail?.scrollIntoView({ block: "nearest" });
  }, [expandedIds, fillHeight]);

  const hasExpand = Boolean(renderDetail);
  const hasActions = Boolean(rowActions);
  /*
   * 행 확장(+) 토글과 행 단위 액션(예: 행 다운로드)은 행 맨 앞 한 칸에 나란히 둔다.
   * 예전에는 액션을 맨 뒤 "관리" 열에 뒀지만, 컬럼이 늘어나면 조작 버튼이 화면 오른쪽 끝으로
   * 밀려 가로 스크롤 없이는 닿지 않는다 — 앞으로 모아 두면 항상 같은 자리에 있다.
   * 헤더는 비워 둔다(조작 열에는 이름을 붙이지 않는다).
   */
  const hasLeadingCell = hasExpand || hasActions;
  const colSpan = columns.length + (hasLeadingCell ? 1 : 0);

  /*
   * 컬럼 너비 드래그 조절.
   * 첫 렌더는 평소처럼 auto 레이아웃으로 그린 뒤, 그때 브라우저가 정한 각 헤더 실제 너비를
   * 측정해 px로 고정한다(초기 모양은 지금과 동일). 이후에는 그 px를 colgroup + table-layout:fixed로
   * 강제하므로, 드래그로 컬럼을 내용보다 좁게도 줄일 수 있다(auto 레이아웃은 내용폭 밑으로 못 줄인다).
   */
  const headRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizingKey, setResizingKey] = useState<string | null>(null);
  // "너비 초기화"가 측정 이펙트를 다시 돌리도록 강제하는 카운터(값 자체엔 의미 없음).
  const [resetNonce, setResetNonce] = useState(0);
  // 드래그 시작 시점의 기준값(어느 컬럼·시작 X·시작 폭) — 리렌더와 무관하게 유지한다.
  const dragRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
  // 최신 columnWidths를 미러링 — 드래그 종료 시점(onUp)에 저장할 값을 읽는 데 쓴다.
  // 렌더 중엔 건드리지 않고(React 규칙), startResize/onMove(이벤트 핸들러)에서만 갱신한다.
  const widthsRef = useRef(columnWidths);
  // 컬럼 구성이 바뀌면(다른 값 세트) 다시 측정하도록 키 시그니처를 의존성에 둔다.
  const columnKeys = columns.map((column) => column.key).join("|");

  useLayoutEffect(() => {
    if (!resizableColumns || columns.length === 0) return;
    let next: Record<string, number> | null = null;
    // 1) 저장된 사용자 지정 너비가 있으면(모든 컬럼을 덮을 때만) 그대로 복원한다 — 측정보다 우선.
    if (persistKey) {
      const stored = readStoredWidths(persistKey);
      if (stored && columns.every((column) => stored[column.key] != null)) next = stored;
    }
    // 2) 없으면 첫 렌더의 실제 너비를 측정해 고정 폭으로 전환한다.
    if (!next) {
      const measured: Record<string, number> = {};
      for (const column of columns) {
        const el = headRefs.current.get(column.key);
        if (el) measured[column.key] = Math.round(el.getBoundingClientRect().width);
      }
      // 모든 컬럼을 측정했을 때만 고정 폭으로 전환한다(부분 측정 상태로 넘어가면 레이아웃이 튄다).
      if (columns.every((column) => measured[column.key])) next = measured;
    }
    // auto→fixed 전환에 필요한 1회 setState라, 대상 값이 정해질 때만 실행되고 루프가 아니다.
    if (next) {
      widthsRef.current = next;
      setColumnWidths(next);
    }
    // columns는 매 렌더 새 배열이라 그대로 넣으면 매번 재실행된다 — 키 시그니처로 대체한다.
    // resetNonce는 "너비 초기화" 시 저장값 삭제 후 자연 너비를 다시 측정하려고 넣는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizableColumns, columnKeys, persistKey, resetNonce]);

  /*
   * 드래그 중에만 전역 pointer 리스너와 커서/선택 잠금을 건다. 핸들러에서 직접 body를 만지면
   * (React Compiler의 불변성 규칙 위반) 대신 resizingKey를 스위치로 삼아 이 effect에서 처리한다.
   */
  useEffect(() => {
    if (!resizingKey) return;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(moveEvent: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const next = Math.max(MIN_COLUMN_WIDTH, Math.round(drag.startWidth + (moveEvent.clientX - drag.startX)));
      // onUp에서 저장할 최종값을 위해 미러 ref도 함께 갱신한다(이벤트 핸들러 → ref 쓰기 허용).
      widthsRef.current = { ...widthsRef.current, [drag.key]: next };
      setColumnWidths((prev) => ({ ...prev, [drag.key]: next }));
    }
    function onUp() {
      dragRef.current = null;
      setResizingKey(null);
      // 드래그가 끝난 시점의 최종 너비만 저장한다(onMove마다 쓰면 낭비). 다음 방문 때 복원된다.
      if (persistKey) writeStoredWidths(persistKey, widthsRef.current);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [resizingKey, persistKey]);

  const registerHead = (key: string) => (el: HTMLTableCellElement | null) => {
    if (el) headRefs.current.set(key, el);
    else headRefs.current.delete(key);
  };

  function startResize(event: React.PointerEvent, key: string) {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      key,
      startX: event.clientX,
      startWidth:
        columnWidths[key] ?? headRefs.current.get(key)?.getBoundingClientRect().width ?? MIN_COLUMN_WIDTH,
    };
    setResizingKey(key);
  }

  function resetColumnWidths() {
    if (persistKey) clearStoredWidths(persistKey);
    widthsRef.current = {};
    // 폭을 비우면 auto 레이아웃으로 돌아가고, resetNonce를 올리면 측정 이펙트가 다시 돌아
    // 지금 내용 기준의 자연 너비를 새로 재서 고정한다(= 기본값으로 복귀).
    setColumnWidths({});
    setResetNonce((nonce) => nonce + 1);
  }

  /*
   * ── 열 순서 드래그 변경 ─────────────────────────────────────────
   * 헤더 셀을 잡고 좌우로 끌면 열 순서가 바뀐다. 정렬 클릭과 같은 자리를 쓰므로
   * REORDER_ACTIVATION_DISTANCE 이상 움직였을 때만 드래그로 판정하고, 그 미만은 클릭으로
   * 남긴다. 드래그 중에는 포인터가 다른 컬럼의 중심선을 넘는 순간 순서를 즉시 바꿔 결과를
   * 미리 보여 주고(컬럼 너비는 key 기준이라 순서를 따라간다), 놓으면 그 순서로 확정된다.
   */
  const [columnOrder, setColumnOrder] = useState<string[] | null>(null); // null = 화면 정의(props) 순서
  // pointerdown~pointerup 사이(아직 클릭일 수도 있는 구간 포함)에만 전역 리스너를 걸기 위한 스위치.
  const [pendingReorderKey, setPendingReorderKey] = useState<string | null>(null);
  // 임계 이동을 넘어 실제로 드래그 중인 컬럼 — 컬럼 하이라이트·커서 잠금의 기준.
  const [reorderingKey, setReorderingKey] = useState<string | null>(null);
  // 드래그 판정 기준값. active 전이는 전역 리스너 안에서 일어나므로 상태가 아니라 ref로 둔다.
  const reorderRef = useRef<{ key: string; startX: number; startY: number; active: boolean } | null>(null);
  // 드래그로 끝난 pointerup 직후 도착하는 click(정렬 토글)을 한 번 삼키는 걸쇠.
  const reorderClickGuardRef = useRef(false);
  // 최신 순서 미러 — 드래그 종료 시점(onUp, 이벤트 핸들러)에서 저장할 값을 읽는 데 쓴다.
  const orderRef = useRef<string[] | null>(null);

  // 저장된 열 순서 복원 — localStorage는 클라이언트 전용이라, SSR 첫 렌더(기본 순서)와의
  // hydration 불일치를 피해 마운트 후 페인트 전에 읽어 적용한다.
  useLayoutEffect(() => {
    if (!reorderableColumns || !persistKey) return;
    const stored = readStoredOrder(persistKey);
    if (stored) {
      orderRef.current = stored;
      setColumnOrder(stored);
    }
  }, [reorderableColumns, persistKey]);

  /*
   * 헤더를 누른 동안에만 전역 포인터 리스너를 건다 — 임계 이동 전에도 움직임을 지켜봐야
   * 클릭/드래그를 가를 수 있다. 드래그 중 컬럼 순서·경계는 상태가 아니라 헤더 rect 실측으로
   * 읽는다 — 스왑 직후 리렌더가 끝나기 전의 move에도 항상 실제 보이는 위치 기준으로 판단하고,
   * 순서가 바뀔 때마다 이 이펙트를 다시 구독할 필요도 없다.
   */
  useEffect(() => {
    if (!pendingReorderKey) return;

    function onMove(moveEvent: PointerEvent) {
      const drag = reorderRef.current;
      if (!drag) return;
      if (!drag.active) {
        // 아직 클릭일 수 있는 구간 — 임계 이동을 넘기 전에는 아무것도 바꾸지 않는다.
        if (
          Math.abs(moveEvent.clientX - drag.startX) < REORDER_ACTIVATION_DISTANCE &&
          Math.abs(moveEvent.clientY - drag.startY) < REORDER_ACTIVATION_DISTANCE
        ) {
          return;
        }
        drag.active = true;
        reorderClickGuardRef.current = true;
        setReorderingKey(drag.key);
      }
      // 행 앞 조작 칸·트레일링 스페이서는 headRefs에 없어 자연히 재배치 대상에서 빠진다.
      const headers: { key: string; left: number; center: number }[] = [];
      for (const [key, el] of headRefs.current) {
        const rect = el.getBoundingClientRect();
        headers.push({ key, left: rect.left, center: rect.left + rect.width / 2 });
      }
      headers.sort((a, b) => a.left - b.left);
      // "포인터보다 중심이 왼쪽인 다른 컬럼 수" = 드래그 컬럼이 놓일 위치. 다른 컬럼의
      // 중심선을 넘는 순간에만 순서가 바뀌므로 폭이 크게 다른 컬럼 사이에서도 흔들리지 않는다.
      const others = headers.filter((header) => header.key !== drag.key);
      const insertIndex = others.filter((header) => header.center < moveEvent.clientX).length;
      const next = others.map((header) => header.key);
      next.splice(insertIndex, 0, drag.key);
      if (next.join("|") === headers.map((header) => header.key).join("|")) return;
      orderRef.current = next;
      setColumnOrder(next);
    }

    function onUp() {
      const drag = reorderRef.current;
      reorderRef.current = null;
      setPendingReorderKey(null);
      setReorderingKey(null);
      if (drag?.active) {
        // 드래그가 끝난 시점의 최종 순서만 저장한다. 다음 방문 때 복원된다.
        if (persistKey && orderRef.current) writeStoredOrder(persistKey, orderRef.current);
        // click은 pointerup 직후(다음 프레임 전)에 도착하므로 걸쇠는 그 뒤에 푼다 —
        // 헤더 밖에서 놓아 click이 아예 오지 않는 경우에도 걸쇠가 남지 않게 된다.
        requestAnimationFrame(() => {
          reorderClickGuardRef.current = false;
        });
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    // 터치 스크롤 등으로 브라우저가 제스처를 가져가면 드래그를 조용히 접는다.
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [pendingReorderKey, persistKey]);

  // 실제 드래그로 판정된 동안에만 커서/선택 잠금 — 클릭일 수도 있는 구간에는 걸지 않는다.
  // (body 스타일 변경은 resizingKey 이펙트와 같은 이유로 핸들러가 아니라 이펙트에서 처리한다.)
  useEffect(() => {
    if (!reorderingKey) return;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [reorderingKey]);

  function startReorder(event: React.PointerEvent, key: string) {
    if (!event.isPrimary || event.button !== 0) return;
    // 새 포인터 조작이 시작됐으니 직전 드래그의 클릭 걸쇠는 무효.
    reorderClickGuardRef.current = false;
    // 임계 이동 전 잔움직임으로 헤더 텍스트가 선택되는 것만 막는다 — click(정렬)은 그대로 발생한다.
    event.preventDefault();
    reorderRef.current = { key, startX: event.clientX, startY: event.clientY, active: false };
    setPendingReorderKey(key);
  }

  /** 드래그로 끝난 조작의 click이 정렬 토글로 번지지 않게 캡처 단계에서 한 번 삼킨다. */
  function guardReorderClick(event: React.MouseEvent) {
    if (!reorderClickGuardRef.current) return;
    reorderClickGuardRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function resetColumnOrder() {
    if (persistKey) clearStoredOrder(persistKey);
    orderRef.current = null;
    setColumnOrder(null); // 화면 정의(props) 순서로 복귀
  }

  // 헤더·본문·colgroup 렌더는 전부 이 순서를 따른다 — 열 순서 변경이 표 전체에 함께 적용된다.
  const orderedColumns = reorderableColumns ? applyColumnOrder(columns, columnOrder) : columns;

  // 행 맨 앞 조작 칸 폭(px) — leadingCellWidth의 Tailwind 클래스(w-14/w-24)와 맞춘다.
  const leadingWidthPx = hasLeadingCell ? (hasExpand && hasActions ? 96 : 56) : 0;
  // 모든 컬럼 폭이 측정된 뒤에만 고정 레이아웃으로 그린다(그 전엔 auto로 첫 측정).
  const resizeReady =
    resizableColumns && columns.length > 0 && columns.every((column) => columnWidths[column.key] != null);
  const totalWidth = resizeReady
    ? leadingWidthPx + columns.reduce((sum, column) => sum + (columnWidths[column.key] ?? 0), 0)
    : 0;
  // 빈/로딩/상세 행이 표 전체 폭을 덮도록, 트레일링 스페이서 컬럼까지 포함한 열 수.
  const spannedColSpan = colSpan + (resizeReady ? 1 : 0);

  /*
   * ── 행 가상화(보이는 영역만 렌더) ─────────────────────────────────
   * 한 페이지에 수백 행을 그리면 <tr>을 한꺼번에 만드는 비용 때문에 첫 렌더가 눈에 띄게 느려진다.
   * 그래서 화면에 걸치는 행만 그리고, 화면 밖 행들이 차지할 높이는 위/아래 스페이서 행 하나로
   * 대신 밀어 준다(스크롤바 길이·스크롤 위치는 그대로 유지된다).
   *
   * 스크롤 주체는 화면 크기에 따라 다르다 —
   *  - fillHeight + lg 이상: 표 컨테이너(table-container)가 스스로 스크롤된다
   *  - 그 밖(lg 미만 · fillHeight 미사용): 앱 셸의 <main>이 스크롤된다
   * 앱 셸이 h-dvh + overflow-hidden이라 창(window)은 아예 스크롤되지 않으므로, 창 스크롤을
   * 가정하면 스크롤 이벤트를 못 받아 첫 화면 분량만 그려진 채 멈춘다. 그래서 특정 요소를
   * 가정하지 않고 본문에서 위로 올라가며 "지금 실제로 스크롤되는" 첫 조상을 찾아 그것에 붙인다.
   */
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  // 툴바 토글로 끌 수 있다 — 끄면 모든 행을 한 번에 그린다(전체 Ctrl+F·인쇄가 필요할 때).
  const [virtualizeRows, setVirtualizeRows] = useState(true);

  const rowEntries: RowEntry<T>[] = [];
  for (const row of data) {
    const id = getRowId(row);
    rowEntries.push({ key: id, id, row, detail: false });
    if (hasExpand && expandedIds.has(id)) {
      rowEntries.push({ key: `${id}:detail`, id, row, detail: true });
    }
  }

  const virtualized = virtualizeRows && !loading && rowEntries.length > 0;

  /*
   * 스크롤 주체와 기준점 찾기.
   * scrollMargin = 스크롤 시작점부터 본문 첫 행까지의 거리(고정 헤더, 또는 <main> 안에서 표 위에
   * 있는 페이지 헤더·검색영역 높이). 알려 주지 않으면 "지금 보이는 구간"이 그만큼 밀려 계산돼
   * 스크롤 중 빈칸이 스친다.
   */
  const [scroller, setScroller] = useState<{ element: HTMLElement | null; margin: number }>({
    element: null,
    margin: 0,
  });
  useLayoutEffect(() => {
    function sync() {
      const body = bodyRef.current;
      if (!body) return;
      let element: HTMLElement | null = null;
      for (let node = body.parentElement; node; node = node.parentElement) {
        if (isScrollable(node)) {
          element = node;
          break;
        }
      }
      // 아직 아무것도 넘치지 않으면(행이 적을 때) 문서 스크롤러로 둔다 — 어차피 전부 화면에 들어온다.
      element = element ?? (document.scrollingElement as HTMLElement | null);
      // 스크롤 위치와 무관한 값이라(스크롤해도 변하지 않는다) 한 번 재면 계속 유효하다.
      const margin = element
        ? Math.max(
            0,
            Math.round(
              body.getBoundingClientRect().top - element.getBoundingClientRect().top + element.scrollTop,
            ),
          )
        : 0;
      setScroller((prev) =>
        prev.element === element && prev.margin === margin ? prev : { element, margin },
      );
    }
    sync();
    // 창 크기가 바뀌면 스크롤 주체(표 안 ↔ 셸)와 표 위 높이가 함께 달라진다.
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
    // 컬럼 구성·고정폭 전환·행 수(행 확장 포함)가 바뀔 때도 다시 잡는다.
  }, [columnKeys, resizeReady, fillHeight, rowEntries.length]);

  const estimateRowSize = (index: number) =>
    rowEntries[index]?.detail ? ESTIMATED_DETAIL_HEIGHT : ESTIMATED_ROW_HEIGHT;
  const getRowKey = (index: number) => rowEntries[index]?.key ?? index;

  /*
   * React Compiler는 이 API를 만나면 DataTable 메모이제이션을 건너뛴다("Compilation Skipped").
   * 가상화 값(getVirtualItems 등)은 스크롤할 때마다 새로 읽어야 하므로 메모이제이션을 포기하는 쪽이
   * 옳은 동작이다 — 캐시되면 스크롤해도 같은 행만 남는다. 그래서 경고는 의도적으로 끈다.
   */
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer<HTMLElement, HTMLTableRowElement>({
    count: rowEntries.length,
    enabled: virtualized,
    getScrollElement: () => scroller.element,
    estimateSize: estimateRowSize,
    getItemKey: getRowKey,
    gap: ROW_GAP_PX,
    overscan: ROW_OVERSCAN,
    scrollMargin: scroller.margin,
    initialRect: { width: 0, height: SSR_VIEWPORT_HEIGHT },
  });

  const virtualItems = virtualized ? virtualizer.getVirtualItems() : [];
  // 가상화가 꺼져 있으면 측정도 하지 않는다(ref를 붙이지 않음).
  const measureRow = virtualized ? virtualizer.measureElement : undefined;

  /*
   * 화면 밖 행들이 차지할 높이 — 위/아래 스페이서 행으로 대신 밀어 준다.
   * 스페이서 행도 border-spacing으로 행 간격(8px)을 한 번 받으므로 그만큼 뺀 높이를 준다.
   */
  const firstItem = virtualItems[0];
  const lastItem = virtualItems[virtualItems.length - 1];
  const padTop = firstItem ? Math.max(0, firstItem.start - scroller.margin - ROW_GAP_PX) : 0;
  const padBottom = lastItem
    ? Math.max(0, virtualizer.getTotalSize() - (lastItem.end - scroller.margin) - ROW_GAP_PX)
    : 0;
  // 지금 실제로 그려진 본문 행 수(상세 행 제외) — 툴바 토글에 표시해 효과를 눈으로 확인할 수 있게 한다.
  const renderedRowCount = virtualized
    ? virtualItems.filter((item) => !rowEntries[item.index]?.detail).length
    : data.length;
  // 그릴 행이 아예 없을 때(로딩·조회결과 없음)는 토글을 숨긴다 — 켜고 끌 대상이 없다.
  const showVirtualizeToggle = !loading && data.length > 0;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(safePage * pageSize, total);

  /*
   * 현재 pageSize가 선택지에 없으면(URL 쿼리로 임의 값이 들어온 경우, 또는 화면이 선택지 밖의
   * 기본값을 쓰는 경우) 그 값을 선택지에 끼워 넣는다 — 없으면 Select가 매칭 항목을 못 찾아
   * 트리거가 빈칸으로 보인다.
   */
  const resolvedPageSizeOptions = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

  /*
   * 헤더 행 고정 — 표가 스크롤되는 fillHeight 모드에서만 켠다(그 외에는 스크롤이 없어 무의미).
   * sticky는 thead/tr 대신 각 th에 걸어야 브라우저 간 동작이 일정하다.
   * 배경: 표는 캔버스(bg-background) 위에 바로 놓이므로 헤더도 같은 색으로 채워 행이 뒤로
   * 지나가도 비치지 않게 한다.
   * 아래 8px 그림자: 행 사이 간격(border-spacing-y-2)만큼 헤더 밑에 빈 틈이 생겨 스크롤 중
   * 행이 그 틈으로 비친다 — 같은 색 그림자로 그 틈을 덮는다.
   */
  const stickyHeadClass = fillHeight
    ? "lg:sticky lg:top-0 lg:z-20 lg:bg-background lg:shadow-[0_8px_0_0_var(--background)]"
    : undefined;

  /*
   * 본문 행 하나(또는 펼친 상세 행 하나)를 그린다 — 가상화 여부와 무관하게 같은 함수를 쓴다.
   * data-index/ref(measureRow)는 가상화가 켜졌을 때만 붙으며, 가상화 계산이 각 행의 실제 높이를
   * 알아내는 통로다(행 확장처럼 높이가 변하는 경우까지 자동으로 반영된다).
   */
  function renderRowEntry(index: number) {
    const entry = rowEntries[index];
    if (!entry) return null;
    const { key, id, row, detail } = entry;
    const expanded = expandedIds.has(id);

    if (detail) {
      return (
        <TableRow
          key={key}
          data-index={index}
          ref={measureRow}
          className="border-none hover:bg-transparent"
        >
          <TableCell data-detail-row={id} colSpan={spannedColSpan} className="rounded-xl bg-row-alt p-5">
            {renderDetail?.(row)}
          </TableCell>
        </TableRow>
      );
    }

    const cells: React.ReactNode[] = [];

    if (hasLeadingCell) {
      cells.push(
        <TableCell key="__row-controls" className={rowCellClass(true, orderedColumns.length === 0, expanded)}>
          {/* 조작 칸의 클릭은 행 클릭(상세 열기)으로 번지지 않게 한다 — 펼치기/행 액션이 우선이다 */}
          <div
            className="flex items-center gap-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            {hasExpand && (
              <Button
                variant="ghost"
                size="icon-xs"
                className="rounded-full"
                aria-expanded={expanded}
                aria-label={expanded ? "상세 접기" : "상세 펼치기"}
                onClick={() => toggleRow(id)}
              >
                {expanded ? <Minus /> : <Plus />}
              </Button>
            )}
            {rowActions?.(row)}
          </div>
        </TableCell>,
      );
    }

    orderedColumns.forEach((column, columnIndex) => {
      cells.push(
        <TableCell
          key={column.key}
          className={cn(
            // 스페이서가 있으면(resizeReady) 마지막 데이터 칸은 끝 칸이 아니다 —
            // 우측 라운드/여백은 스페이서가 맡으므로 여기선 주지 않는다.
            rowCellClass(
              !hasLeadingCell && columnIndex === 0,
              !resizeReady && columnIndex === orderedColumns.length - 1,
              expanded,
              // 드래그 중인 컬럼은 본문까지 세로 밴드로 강조해 어느 열이 움직이는지 보여 준다.
              column.key === reorderingKey,
            ),
            alignClass(column.align, column.numeric),
            column.numeric && "font-mono tabular-nums",
            // 고정 폭 모드: 컬럼을 내용보다 좁게 줄였을 때 옆 칸으로 새지 않도록 잘라낸다.
            resizableColumns && "overflow-hidden text-ellipsis",
            column.cellClassName,
          )}
        >
          {column.cell(row)}
        </TableCell>,
      );
    });

    // 트레일링 스페이서 셀 — 남는 폭을 카드 배경으로 채워 행이 오른쪽 끝까지 이어지게 한다.
    // 우측 라운드/여백을 이 칸이 맡는다. 스크롤이 필요할 만큼 넓히면 폭 0으로 접힌다.
    if (resizeReady) {
      cells.push(
        <TableCell key="__row-spacer" aria-hidden className={rowCellClass(false, true, expanded)} />,
      );
    }

    return (
      <TableRow
        key={key}
        data-index={index}
        ref={measureRow}
        // 행 클릭으로 상세를 열 수 있게 한다. 키보드에서도 같은 동작이 되도록 포커스를 받고
        // Enter/Space에 반응한다. 본문 텍스트를 드래그로 선택한 직후에는 열지 않는다
        // (주문번호 등을 복사하려던 조작이 팝업 열기로 오해되지 않게 한다).
        onClick={
          onRowClick
            ? () => {
                if (window.getSelection()?.toString()) return;
                onRowClick(row);
              }
            : undefined
        }
        onKeyDown={
          onRowClick
            ? (event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onRowClick(row);
              }
            : undefined
        }
        tabIndex={onRowClick ? 0 : undefined}
        aria-haspopup={onRowClick ? "dialog" : undefined}
        className={cn(
          "group/row border-none transition-[filter] duration-150 hover:bg-transparent",
          expanded ? ROW_SHADOW_SELECTED : cn(ROW_SHADOW, ROW_SHADOW_HOVER),
          onRowClick &&
            "cursor-pointer outline-none focus-visible:[&>td]:bg-row-alt focus-visible:[&>td:first-child]:ring-2 focus-visible:[&>td:first-child]:ring-ring/50",
        )}
      >
        {cells}
      </TableRow>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", fillHeight && "lg:min-h-0 lg:flex-1", className)}>
      {/* 표 상단 툴바 — 검색영역과 표 사이. 왼쪽은 조회 결과 총 건수,
       * 오른쪽은 열 너비 초기화(resizable일 때)·열 순서 초기화(reorderable일 때)·
       * 가상 스크롤 토글·화면별 액션(toolbarActions).
       * 공통 컴포넌트라 특정 부품을 직접 알지 않고, 다운로드 등은 toolbarActions로 주입받는다. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        {/* 총 건수 = 현재 페이지가 아니라 검색 조건에 걸린 전체 건수(total) */}
        <span className="text-xs text-tertiary-foreground">
          총 {" "}
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {total.toLocaleString()}
          </span>
           건
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {resizableColumns && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetColumnWidths}
              className="h-8 gap-1.5 px-2 text-xs "
            >
              <RotateCcw className="size-3.5" />열 너비 초기화
            </Button>
          )}
          {reorderableColumns && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetColumnOrder}
              className="h-8 gap-1.5 px-2 text-xs "
            >
              <ArrowLeftRight className="size-3.5" />열 순서 초기화
            </Button>
          )}
          {/* 행 가상화 토글 — 지금 몇 행이 실제로 그려졌는지(그린 행/전체 행) 함께 보여 준다. */}
          {showVirtualizeToggle && (
            <Button
              type="button"
              variant={"ghost"}
              size="sm"
              aria-pressed={virtualizeRows}
              onClick={() => setVirtualizeRows((enabled) => !enabled)}
              // 지금 몇 행이 실제로 그려졌는지(그린 행/전체 행)를 툴팁에 함께 보여 준다.
              title={
                virtualizeRows
                  ? `조건검색 사용안함 — 화면에 보이는 내용에서만 Ctrl+F로 검색가능`
                  : `조건검색 — Ctrl+F로 전체 검색 가능, 행이 많으면 느려짐.`
              }
              className={"h-8 gap-1.5 px-2 text-xs"}
            >
              <Rows3 className="size-3.5" />
              전체검색 {virtualizeRows ? "OFF" : "ON"}
            </Button>
          )}
          {toolbarActions}
        </div>
      </div>
      {/* 스크롤 컨테이너는 Table 내부의 table-container 하나뿐이다 — sticky 헤더가 이 컨테이너를
       * 기준으로 고정되므로, 높이 제약도 바깥에 div를 더 두지 않고 여기에 직접 건다 */}
      <Table
        container={
          fillHeight
            ? {
                ref: scrollRef,
                // overflow-anchor 해제 — 스크롤 앵커링이 재사용된 행에 스크롤을 붙잡아 두면
                // 위의 "맨 위로" 복귀가 되돌려진다(Rows per page 변경 시 특히).
                className: "lg:min-h-0 lg:flex-1 lg:[overflow-anchor:none]",
                // 표 안에서만 스크롤되므로 이 영역 자체가 키보드로 초점을 받을 수 있어야
                // PageDown/방향키로 목록을 넘길 수 있다(마우스 없이도 스크롤 가능해야 한다).
                tabIndex: 0,
                role: "region",
                "aria-label": "목록 스크롤 영역",
              }
            : undefined
        }
        // resizeReady면 table-layout:fixed로 전환하되 기본 폭은 100%로 둔다 — 컬럼을 줄여
        // 합이 컨테이너보다 작아져도 표가 컨테이너를 꽉 채우고, 남는 폭은 맨 끝 스페이서 컬럼이
        // 흡수한다(각 컬럼은 드래그한 px 그대로 유지 → 1:1 드래그감). min-width로 컬럼 합을 보장해
        // 컬럼을 넓혀 합이 컨테이너를 넘으면 그때부터 가로 스크롤된다.
        style={resizeReady ? { width: "100%", minWidth: `${totalWidth}px`, tableLayout: "fixed" } : undefined}
        className={cn(
          "border-separate border-spacing-x-0 border-spacing-y-2",
          // 열 순서 드래그 중에는 표 내부 hover/커서가 끼어들지 않게 잠근다 — 드래그는 전역
          // 리스너로 진행되므로 그동안 표가 포인터 이벤트를 받을 필요가 없다.
          reorderingKey && "pointer-events-none",
          // border-spacing은 헤더 행 위에도 8px을 남긴다 — 그대로 두면 sticky(top-0)가 걸리는
          // 순간 헤더가 그 8px만큼 위로 튄다. 표를 미리 8px 끌어올려 처음부터 붙여 둔다.
          // scroll-mt: 포커스가 위쪽 행으로 이동할 때 브라우저가 그 행을 컨테이너 맨 위에 붙이는데,
          // 그 자리는 고정 헤더(40px + 아래 8px 틈) 뒤라 포커스 링이 가려진다 — 그만큼 여백을 준다.
          fillHeight && "lg:-mt-2 lg:[&_tbody_button]:scroll-mt-12",
        )}
      >
        {resizeReady && (
          <colgroup>
            {hasLeadingCell && <col style={{ width: `${leadingWidthPx}px` }} />}
            {orderedColumns.map((column) => (
              <col key={column.key} style={{ width: `${columnWidths[column.key]}px` }} />
            ))}
            {/* 폭 미지정(auto) 스페이서 — 표 폭(100%)에서 컬럼 합을 뺀 나머지를 흡수한다.
               합이 컨테이너를 넘으면(min-width) 나머지가 0이라 이 컬럼은 폭 0으로 접힌다. */}
            <col />
          </colgroup>
        )}
        <TableHeader>
          <TableRow className="border-none hover:bg-transparent">
            {hasLeadingCell && (
              <TableHead className={cn(leadingCellWidth(hasExpand, hasActions), "pl-5", stickyHeadClass)} />
            )}
            {orderedColumns.map((column, index) => {
              const sortable = Boolean(onSortChange) && column.sortable !== false;
              const isSorted = sortable && sort === column.key;
              // 클릭 시 다음 상태: 정렬 안 됨 → 오름 → 내림 → 해제(null) → (다시 오름).
              const nextOrder: "asc" | "desc" | null = !isSorted
                ? "asc"
                : order === "asc"
                  ? "desc"
                  : null;
              const alignsRight = (column.align ?? (column.numeric ? "right" : "left")) === "right";
              return (
                <TableHead
                  key={column.key}
                  ref={resizableColumns || reorderableColumns ? registerHead(column.key) : undefined}
                  style={column.width ? { width: column.width } : undefined}
                  aria-sort={isSorted ? (order === "desc" ? "descending" : "ascending") : undefined}
                  // 열 순서 드래그 시작점 — 임계 이동 전에는 아무 효과가 없어 정렬 클릭과 공존한다.
                  // 우측 경계의 너비 조절 핸들은 pointerdown을 전파하지 않아 여기 걸리지 않는다.
                  onPointerDown={reorderableColumns ? (event) => startReorder(event, column.key) : undefined}
                  onClickCapture={reorderableColumns ? guardReorderClick : undefined}
                  className={cn(
                    alignClass(column.align, column.numeric),
                    "h-9 text-[11px] font-medium tracking-wide text-tertiary-foreground",
                    !hasLeadingCell && index === 0 && "pl-5",
                    index === orderedColumns.length - 1 && "pr-5",
                    // 드래그 핸들의 위치 기준(relative). lg에서는 뒤의 lg:sticky가 위치를 잡으므로
                    // 소스 순서상 sticky가 이겨 헤더 고정 동작은 그대로다.
                    resizableColumns && "group/head relative overflow-hidden",
                    stickyHeadClass,
                    // 드래그 중인 컬럼 강조 — 본문 셀의 세로 밴드(rowCellClass)와 짝을 이룬다.
                    // sticky 헤더의 lg:bg-background에 덮이지 않도록 important로 준다.
                    reorderingKey === column.key && "rounded-md bg-secondary!",
                    column.headerClassName,
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onSortChange?.(column.key, nextOrder)}
                      className={cn(
                        "group/sort -mx-1 inline-flex max-w-full items-center gap-1 rounded px-1 py-0.5 align-middle transition-colors hover:text-foreground",
                        isSorted && "text-foreground",
                        // 우측 정렬 컬럼은 아이콘이 라벨 왼쪽에 오도록 뒤집는다.
                        alignsRight && "flex-row-reverse",
                      )}
                    >
                      <span className="truncate">{column.header}</span>
                      <SortIndicator active={isSorted} order={order} />
                    </button>
                  ) : (
                    column.header
                  )}
                  {resizableColumns && (
                    <span
                      aria-hidden
                      onPointerDown={(event) => startResize(event, column.key)}
                      onClick={(event) => event.stopPropagation()}
                      className="group/resize absolute inset-y-0 right-0 z-30 flex w-2.5 cursor-col-resize touch-none items-stretch justify-end select-none"
                    >
                      <span
                        className={cn(
                          "my-2 w-px rounded-full bg-transparent transition-colors",
                          "group-hover/head:bg-border group-hover/resize:bg-primary!",
                          resizingKey === column.key && "bg-primary!",
                        )}
                      />
                    </span>
                  )}
                </TableHead>
              );
            })}
            {/* 트레일링 스페이서 헤더 — 남는 폭을 차지하는 빈 칸(고정 헤더 배경만 이어 준다) */}
            {resizeReady && <TableHead aria-hidden className={stickyHeadClass} />}
          </TableRow>
        </TableHeader>
        <TableBody ref={bodyRef}>
          {loading ? (
            <LoadingRows colSpan={spannedColSpan} rowCount={Math.min(pageSize, 8)} />
          ) : data.length === 0 ? (
            <TableRow className="border-none hover:bg-transparent">
              <TableCell
                colSpan={spannedColSpan}
                className={cn(
                  "h-32 rounded-xl bg-card text-center text-sm text-muted-foreground",
                  ROW_SHADOW,
                )}
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            <>
              {/* 위쪽 화면 밖 행들의 높이 */}
              {padTop > 0 && <SpacerRow colSpan={spannedColSpan} height={padTop} />}
              {virtualized
                ? virtualItems.map((item) => renderRowEntry(item.index))
                : rowEntries.map((_, index) => renderRowEntry(index))}
              {/* 아래쪽 화면 밖 행들의 높이 */}
              {padBottom > 0 && <SpacerRow colSpan={spannedColSpan} height={padBottom} />}
            </>
          )}
        </TableBody>
      </Table>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-4 px-1 text-sm text-tertiary-foreground">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs">Rows per page</span>
            <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
              {/* w-20: 3자리(100~500)가 잘리지 않는 최소 폭 — 트리거 좌우 패딩 + 화살표를 뺀 여백 기준 */}
              <SelectTrigger size="sm" className="w-20">
                <SelectValue />
              </SelectTrigger>
              {/* min-w-0: 옵션이 3자리 숫자뿐이라 공통 최소폭(min-w-36)을 쓰면 팝업만 트리거보다
                * 훨씬 넓어져 옆으로 삐져나온다 — 트리거 폭(--anchor-width)에 그대로 맞춘다. */}
              <SelectContent className="min-w-0">
                {resolvedPageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <span className="text-xs font-medium tabular-nums">
          {rangeStart}-{rangeEnd} of {total}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-full"
            disabled={safePage <= 1}
            aria-label="이전 페이지"
            onClick={() => onPageChange(safePage - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-full"
            disabled={safePage >= totalPages}
            aria-label="다음 페이지"
            onClick={() => onPageChange(safePage + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * 정렬 상태 아이콘 — 정렬 중인 컬럼엔 방향(▲/▼)을, 그 외 정렬 가능한 컬럼엔
 * 호버 시에만 흐릿한 양방향 아이콘을 보여 클릭 가능함을 알린다.
 */
function SortIndicator({ active, order }: { active: boolean; order?: "asc" | "desc" }) {
  if (active) {
    return order === "desc" ? (
      <ChevronDown className="size-3.5 shrink-0" />
    ) : (
      <ChevronUp className="size-3.5 shrink-0" />
    );
  }
  return (
    <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover/sort:opacity-100" />
  );
}

/**
 * 카드형 행의 셀 하나 — 배경/패딩을 공통으로, 좌·우 모서리 라운드는 양 끝 셀에만 준다.
 * isFirst/isLast를 따로 받는 이유: 컬럼이 하나뿐이면 그 셀이 첫 칸이면서 끝 칸이라
 * 한 가지 위치 값으로는 양쪽 라운드를 동시에 표현할 수 없다.
 * dragging: 열 순서 드래그 중인 컬럼의 셀 — 열 전체가 세로 밴드로 강조되게 배경을 바꾼다.
 */
function rowCellClass(isFirst: boolean, isLast: boolean, expanded: boolean, dragging = false) {
  return cn(
    "border-none py-4 transition-colors",
    expanded || dragging ? "bg-secondary" : "bg-card group-hover/row:bg-row-alt",
    isFirst && "rounded-l-xl pl-5",
    isLast && "rounded-r-xl pr-5",
  );
}

/** 행 맨 앞 조작 칸의 폭 — 버튼(24px) 개수와 사이 간격(6px), 좌측 패딩(20px)을 감싼다 */
function leadingCellWidth(hasExpand: boolean, hasActions: boolean) {
  return hasExpand && hasActions ? "w-24" : "w-14";
}

/**
 * 가상화 스페이서 행 — 화면 밖 행들이 차지할 높이만큼 자리만 밀어 준다(내용 없음).
 * TableRow/TableCell 대신 소재 태그를 쓰는 이유: 카드 배경·테두리·패딩이 붙으면 빈 줄이 보인다.
 */
function SpacerRow({ colSpan, height }: { colSpan: number; height: number }) {
  return (
    <tr aria-hidden>
      <td colSpan={colSpan} style={{ height, padding: 0, border: 0 }} />
    </tr>
  );
}

function LoadingRows({ colSpan, rowCount }: { colSpan: number; rowCount: number }) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, index) => (
        <TableRow key={index} className="border-none hover:bg-transparent">
          <TableCell colSpan={colSpan} className="rounded-xl bg-card py-3.5">
            <Skeleton className="h-4 w-full" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function alignClass(align: "left" | "center" | "right" | undefined, numeric?: boolean) {
  const resolved = align ?? (numeric ? "right" : "left");
  if (resolved === "right") return "text-right";
  if (resolved === "center") return "text-center";
  return "text-left";
}
