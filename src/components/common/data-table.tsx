"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
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
   * 지정하면(그리고 resizableColumns가 켜져 있으면) 사용자가 드래그로 바꾼 컬럼 너비를
   * 이 키로 localStorage에 저장해 다음 방문에도 복원한다. 표마다 고유한 값을 준다(예: "inbound").
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
  persistKey,
  sort,
  order,
  onSortChange,
  renderDetail,
  rowActions,
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  return (
    <div className={cn("flex flex-col gap-3", fillHeight && "lg:min-h-0 lg:flex-1", className)}>
      {/* 표 상단 툴바 — 검색영역과 표 사이. 열 너비 초기화(resizable일 때)와 화면별 액션(toolbarActions).
       * 공통 컴포넌트라 특정 부품을 직접 알지 않고, 다운로드 등은 toolbarActions로 주입받는다. */}
      {(resizableColumns || toolbarActions) && (
        <div className="flex shrink-0 items-center justify-end gap-2">
          {resizableColumns && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetColumnWidths}
              className="h-8 gap-1.5 px-2 text-xs text-tertiary-foreground"
            >
              <RotateCcw className="size-3.5" />열 너비 초기화
            </Button>
          )}
          {toolbarActions}
        </div>
      )}
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
            {columns.map((column) => (
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
            {columns.map((column, index) => {
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
                  ref={resizableColumns ? registerHead(column.key) : undefined}
                  style={column.width ? { width: column.width } : undefined}
                  aria-sort={isSorted ? (order === "desc" ? "descending" : "ascending") : undefined}
                  className={cn(
                    alignClass(column.align, column.numeric),
                    "h-9 text-[11px] font-medium tracking-wide text-tertiary-foreground",
                    !hasLeadingCell && index === 0 && "pl-5",
                    index === columns.length - 1 && "pr-5",
                    // 드래그 핸들의 위치 기준(relative). lg에서는 뒤의 lg:sticky가 위치를 잡으므로
                    // 소스 순서상 sticky가 이겨 헤더 고정 동작은 그대로다.
                    resizableColumns && "group/head relative overflow-hidden",
                    stickyHeadClass,
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
        <TableBody>
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
            data.map((row) => {
              const id = getRowId(row);
              const expanded = expandedIds.has(id);
              const cells: React.ReactNode[] = [];

              if (hasLeadingCell) {
                cells.push(
                  <TableCell
                    key="__row-controls"
                    className={rowCellClass(true, columns.length === 0, expanded)}
                  >
                    <div className="flex items-center gap-1.5">
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

              columns.forEach((column, index) => {
                cells.push(
                  <TableCell
                    key={column.key}
                    className={cn(
                      // 스페이서가 있으면(resizeReady) 마지막 데이터 칸은 끝 칸이 아니다 —
                      // 우측 라운드/여백은 스페이서가 맡으므로 여기선 주지 않는다.
                      rowCellClass(
                        !hasLeadingCell && index === 0,
                        !resizeReady && index === columns.length - 1,
                        expanded,
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
                <Fragment key={id}>
                  <TableRow
                    className={cn(
                      "group/row border-none transition-[filter] duration-150 hover:bg-transparent",
                      expanded ? ROW_SHADOW_SELECTED : cn(ROW_SHADOW, ROW_SHADOW_HOVER),
                    )}
                  >
                    {cells}
                  </TableRow>
                  {hasExpand && expanded && (
                    <TableRow className="border-none hover:bg-transparent">
                      <TableCell
                        data-detail-row={id}
                        colSpan={spannedColSpan}
                        className="rounded-xl bg-row-alt p-5"
                      >
                        {renderDetail?.(row)}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })
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
              <SelectContent>
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
 */
function rowCellClass(isFirst: boolean, isLast: boolean, expanded: boolean) {
  return cn(
    "border-none py-4 transition-colors",
    expanded ? "bg-secondary" : "bg-card group-hover/row:bg-row-alt",
    isFirst && "rounded-l-xl pl-5",
    isLast && "rounded-r-xl pr-5",
  );
}

/** 행 맨 앞 조작 칸의 폭 — 버튼(24px) 개수와 사이 간격(6px), 좌측 패딩(20px)을 감싼다 */
function leadingCellWidth(hasExpand: boolean, hasActions: boolean) {
  return hasExpand && hasActions ? "w-24" : "w-14";
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
