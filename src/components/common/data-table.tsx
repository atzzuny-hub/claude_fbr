"use client";

import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
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
  /** 행 확장(+) 슬롯 — 지정 시 각 행 앞에 확장 토글이 생기고 펼치면 이 내용이 아래 행으로 붙는다 */
  renderDetail?: (row: T) => React.ReactNode;
  /** 행 단위 액션 슬롯 — 예: 행별 엑셀 다운로드 아이콘 */
  rowActions?: (row: T) => React.ReactNode;
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

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

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
  renderDetail,
  rowActions,
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(safePage * pageSize, total);

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
        className={cn(
          "border-separate border-spacing-x-0 border-spacing-y-2",
          // border-spacing은 헤더 행 위에도 8px을 남긴다 — 그대로 두면 sticky(top-0)가 걸리는
          // 순간 헤더가 그 8px만큼 위로 튄다. 표를 미리 8px 끌어올려 처음부터 붙여 둔다.
          // scroll-mt: 포커스가 위쪽 행으로 이동할 때 브라우저가 그 행을 컨테이너 맨 위에 붙이는데,
          // 그 자리는 고정 헤더(40px + 아래 8px 틈) 뒤라 포커스 링이 가려진다 — 그만큼 여백을 준다.
          fillHeight && "lg:-mt-2 lg:[&_tbody_button]:scroll-mt-12",
        )}
      >
        <TableHeader>
          <TableRow className="border-none hover:bg-transparent">
            {hasLeadingCell && (
              <TableHead className={cn(leadingCellWidth(hasExpand, hasActions), "pl-5", stickyHeadClass)} />
            )}
            {columns.map((column, index) => (
              <TableHead
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  alignClass(column.align, column.numeric),
                  "h-9 text-[11px] font-medium tracking-wide text-tertiary-foreground",
                  !hasLeadingCell && index === 0 && "pl-5",
                  index === columns.length - 1 && "pr-5",
                  stickyHeadClass,
                  column.headerClassName,
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <LoadingRows colSpan={colSpan} rowCount={Math.min(pageSize, 8)} />
          ) : data.length === 0 ? (
            <TableRow className="border-none hover:bg-transparent">
              <TableCell
                colSpan={colSpan}
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
                      rowCellClass(!hasLeadingCell && index === 0, index === columns.length - 1, expanded),
                      alignClass(column.align, column.numeric),
                      column.numeric && "font-mono tabular-nums",
                      column.cellClassName,
                    )}
                  >
                    {column.cell(row)}
                  </TableCell>,
                );
              });

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
                        colSpan={colSpan}
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
              <SelectTrigger size="sm" className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((option) => (
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
