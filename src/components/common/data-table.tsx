"use client";

import { Fragment, useState } from "react";
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
  className,
}: DataTableProps<T>) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleRow(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const hasExpand = Boolean(renderDetail);
  const hasActions = Boolean(rowActions);
  const colSpan = columns.length + (hasExpand ? 1 : 0) + (hasActions ? 1 : 0);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(safePage * pageSize, total);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="overflow-x-auto">
        <Table className="border-separate border-spacing-x-0 border-spacing-y-2">
          <TableHeader>
            <TableRow className="border-none hover:bg-transparent">
              {hasExpand && <TableHead className="w-10 pl-5" />}
              {columns.map((column, index) => (
                <TableHead
                  key={column.key}
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(
                    alignClass(column.align, column.numeric),
                    "h-9 text-[11px] font-medium tracking-wide text-tertiary-foreground",
                    !hasExpand && index === 0 && "pl-5",
                    !hasActions && index === columns.length - 1 && "pr-5",
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
              {hasActions && (
                <TableHead className="w-12 pr-5 text-right text-[11px] font-medium tracking-wide text-tertiary-foreground">
                  관리
                </TableHead>
              )}
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

                if (hasExpand) {
                  cells.push(
                    <TableCell key="__expand" className={rowCellClass("first", expanded)}>
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
                    </TableCell>,
                  );
                }

                columns.forEach((column, index) => {
                  const position =
                    !hasExpand && index === 0
                      ? "first"
                      : !hasActions && index === columns.length - 1
                        ? "last"
                        : "middle";
                  cells.push(
                    <TableCell
                      key={column.key}
                      className={cn(
                        rowCellClass(position, expanded),
                        alignClass(column.align, column.numeric),
                        column.numeric && "font-mono tabular-nums",
                        column.cellClassName,
                      )}
                    >
                      {column.cell(row)}
                    </TableCell>,
                  );
                });

                if (hasActions) {
                  cells.push(
                    <TableCell key="__actions" className={cn(rowCellClass("last", expanded), "text-right")}>
                      {rowActions?.(row)}
                    </TableCell>,
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
                        <TableCell colSpan={colSpan} className="rounded-xl bg-row-alt p-5">
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
      </div>

      <div className="flex flex-wrap items-center justify-end gap-4 px-1 text-sm text-tertiary-foreground">
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

/** 카드형 행의 셀 하나 — 배경/패딩/모서리 라운드를 위치(첫/중간/끝)에 따라 이어붙인다 */
function rowCellClass(position: "first" | "middle" | "last", expanded: boolean) {
  return cn(
    "border-none py-4 transition-colors",
    expanded ? "bg-secondary" : "bg-card group-hover/row:bg-row-alt",
    position === "first" && "rounded-l-xl pl-5",
    position === "last" && "rounded-r-xl pr-5",
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
