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

/** 행 하나의 내보내기 방식 — 클라이언트 CSV 생성(row+columns)과 서버 생성 파일(downloadUrl) 중 하나만 준다. */
export type RowExportButtonProps<T> = { ariaLabel?: string } & (
  | {
      /** 클라이언트 CSV 생성 모드 — 목 폴백·서버 파일 엔드포인트 미확정 도메인용 */
      row: T;
      columns: ExcelDownloadColumn<T>[];
      /** 확장자 제외 파일명 — 행 식별자를 포함해 화면이 정한다(예: `inbound-${row.ganNo}`) */
      filename: string;
      downloadUrl?: never;
    }
  | {
      /** 서버 생성 파일 다운로드 모드 — BFF 파일 엔드포인트(예: `/api/dtin/dn/${row.idx}`) */
      downloadUrl: string;
      /** 서버가 Content-Disposition 파일명을 안 줄 때의 폴백(확장자 포함 권장) */
      filename?: string;
      row?: never;
      columns?: never;
    }
);

/**
 * 행 단위 다운로드 아이콘 버튼(F012) — DataTable rowActions 슬롯에 넣는 정형.
 * 툴바/헤더의 "엑셀 다운로드"와 같은 톤(흰 배경 + 초록 아이콘, EXCEL_BUTTON_TONE)을 공유해
 * 같은 다운로드 동작이 위치에 따라 다른 색으로 보이지 않게 한다.
 *
 * downloadUrl(서버 모드)이면 BFF에서 파일을 blob으로 받아 저장한다 — 파일명은 서버
 * Content-Disposition 우선, 받는 동안 버튼은 비활성. 401은 /login 이동(세션 만료).
 * 입고가 이 모드 사용 중(GET /api/dtin/dn/{idx})이고, 서버 엔드포인트가 확정되지 않은
 * 도메인은 row/columns(클라이언트 CSV 생성) 모드를 쓴다.
 */
export function RowExportButton<T = unknown>(props: RowExportButtonProps<T>) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (props.downloadUrl !== undefined) {
      setBusy(true);
      try {
        await downloadServerFile(props.downloadUrl, props.filename);
      } finally {
        setBusy(false);
      }
      return;
    }
    exportRowsToCsv([props.row], props.columns, props.filename);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-xs"
      className={EXCEL_BUTTON_TONE}
      aria-label={props.ariaLabel ?? "이 행 다운로드"}
      disabled={busy}
      onClick={handleClick}
    >
      <Download />
    </Button>
  );
}

/**
 * BFF 파일 엔드포인트 응답을 blob으로 받아 저장한다 — 파일명은 서버 Content-Disposition
 * 우선, 없으면 폴백. 401(세션 만료)은 화면 관례대로 /login 이동으로 수렴시킨다.
 */
async function downloadServerFile(url: string, fallbackFilename?: string): Promise<void> {
  const res = await fetch(url);
  if (res.status === 401) {
    window.location.href = "/login";
    return;
  }
  if (!res.ok) {
    throw new Error(`파일 다운로드 실패: HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const serverName = parseDispositionFilename(res.headers.get("content-disposition"));
  saveBlob(blob, serverName ?? fallbackFilename ?? `export-${timestamp()}`);
}

/** Content-Disposition에서 파일명 추출 — RFC 5987(filename*=UTF-8''…) 우선, 없으면 filename="…" */
function parseDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const star = header.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // 인코딩이 깨진 값이면 아래 filename= 표기로 폴백
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1].trim() : null;
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
  saveBlob(blob, `${filename ?? `export-${timestamp()}`}.csv`);
}

/** blob을 브라우저 다운로드로 저장한다(앵커 클릭 방식) — CSV 생성·서버 파일 두 경로가 공유. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
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
