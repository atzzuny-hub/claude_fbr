"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * 엑셀 내보내기 버튼 톤 — 흰 배경(outline) + 초록 글자·아이콘.
 * 엑셀을 뜻하는 초록은 success 토큰을 쓴다(하드코딩 색 금지, 다크 모드도 토큰이 따라간다).
 * outline variant의 hover가 글자색을 foreground로 덮으므로 hover에도 초록을 다시 고정한다.
 * 행 단위 다운로드(아이콘 전용) 버튼도 이 상수를 공유해 위치와 무관하게 같은 톤을 유지한다.
 */
export const EXCEL_BUTTON_TONE = "text-success text-xs hover:text-success";

export interface ExcelDownloadColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

interface ExcelDownloadButtonBaseProps<T> extends VariantProps<typeof buttonVariants> {
  columns: ExcelDownloadColumn<T>[];
  /** 확장자 제외 파일명 — 기본값: `export-YYYYMMDDHHmmss` */
  filename?: string;
  label?: string;
  /** getRows 조회 동안 표시할 라벨 */
  busyLabel?: string;
  disabled?: boolean;
  className?: string;
}

/** 내보낼 행의 출처 — 이미 받아 둔 data와 클릭 시점 조회 getRows 중 정확히 하나만 준다. */
export type ExcelDownloadButtonProps<T> = ExcelDownloadButtonBaseProps<T> &
  (
    | { data: T[]; getRows?: never }
    | { getRows: () => Promise<T[]>; data?: never }
  );

/**
 * 검색결과 전체 다운로드 버튼(F012) — 행 출처에 따라 두 모드로 동작한다.
 *
 * - `data`(동기): 이미 받아 둔 조회 결과를 클릭 즉시 CSV로 저장한다(빈 목록이면 비활성).
 * - `getRows`(비동기): 클릭 시점에 현재 검색 조건의 전체 결과(페이지네이션 미적용)를
 *   조회해 저장하고, 조회 동안 busyLabel을 표시한다. 페이지를 그릴 때마다 전체 결과를
 *   미리 받아 두지 않아 매 조회 2중 호출(목록 + 전체) 비용이 없다 — 실 API 화면은 이 모드.
 *
 * CSV는 브라우저에서 직접 생성한다(엑셀에서 바로 열리도록 UTF-8 BOM 포함).
 *
 * Phase 2 교체 지점: 서버 생성 엑셀 엔드포인트가 확정된 도메인(입고는
 * INBOUND_API.download = /dtin/dn)부터 onClick 내부를 BFF 경유 파일 다운로드로 교체한다
 * (이 컴포넌트 내부만 바뀐다). 그때는 궁극적으로 columns/데이터 조회가 서버 몫이 된다.
 */
export function ExcelDownloadButton<T>({
  data,
  getRows,
  columns,
  filename,
  label = "엑셀 다운로드",
  busyLabel = "다운로드 중…",
  disabled,
  className,
  variant = "link",
  size,
}: ExcelDownloadButtonProps<T>) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (getRows) {
      setBusy(true);
      try {
        exportRowsToCsv(await getRows(), columns, filename);
      } finally {
        setBusy(false);
      }
      return;
    }
    exportRowsToCsv(data ?? [], columns, filename);
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(EXCEL_BUTTON_TONE, className)}
      disabled={disabled || busy || (data ? data.length === 0 : false)}
      onClick={handleClick}
    >
      <Download data-icon="inline-end" />
      {busy ? busyLabel : label}
    </Button>
  );
}

export interface RowExportButtonProps<T> {
  row: T;
  columns: ExcelDownloadColumn<T>[];
  /** 확장자 제외 파일명 — 행 식별자를 포함해 화면이 정한다(예: `inbound-${row.ganNo}`) */
  filename: string;
  ariaLabel?: string;
}

/**
 * 행 단위 다운로드 아이콘 버튼(F012) — DataTable rowActions 슬롯에 넣는 정형.
 * 툴바/헤더의 "엑셀 다운로드"와 같은 톤(흰 배경 + 초록 아이콘, EXCEL_BUTTON_TONE)을 공유해
 * 같은 다운로드 동작이 위치에 따라 다른 색으로 보이지 않게 한다.
 *
 * Phase 2 교체 지점: 행 상세 엑셀은 서버 생성 파일 엔드포인트로 교체 예정(입고는
 * INBOUND_API.downloadRow = /dtin/dn/{idx} 확정) — 이 컴포넌트의 onClick만 바꾸면
 * 전 도메인 표에 한 번에 반영된다(그때 행 다운로드 URL을 props로 받는 형태가 될 것).
 */
export function RowExportButton<T>({
  row,
  columns,
  filename,
  ariaLabel = "이 행 다운로드",
}: RowExportButtonProps<T>) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-xs"
      className={EXCEL_BUTTON_TONE}
      aria-label={ariaLabel}
      onClick={() => exportRowsToCsv([row], columns, filename)}
    >
      <Download />
    </Button>
  );
}

/**
 * 행 단위 다운로드(F012) 등 버튼 UI 없이 내보내기만 필요한 곳에서 재사용하는 순수 함수.
 * ExcelDownloadButton·RowExportButton과 동일한 CSV 생성 로직을 공유한다.
 */
export function exportRowsToCsv<T>(
  rows: T[],
  columns: ExcelDownloadColumn<T>[],
  filename?: string,
): void {
  if (typeof window === "undefined" || rows.length === 0) return;

  const header = columns.map((column) => escapeCsvCell(column.header));
  const lines = rows.map((row) =>
    columns.map((column) => escapeCsvCell(column.accessor(row))).join(","),
  );
  // 엑셀 한글 깨짐 방지를 위해 UTF-8 BOM을 앞에 붙인다.
  const csv = "﻿" + [header.join(","), ...lines].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename ?? `export-${timestamp()}`}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
