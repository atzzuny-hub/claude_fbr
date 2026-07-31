"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

export interface ExcelDownloadColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

export interface ExcelDownloadButtonProps<T> extends VariantProps<typeof buttonVariants> {
  data: T[];
  columns: ExcelDownloadColumn<T>[];
  /** 확장자 제외 파일명 — 기본값: `export-YYYYMMDDHHmmss` */
  filename?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * 검색결과 전체 다운로드 버튼.
 *
 * Phase 1: 브라우저에서 현재 필터가 적용된 조회 결과(data)를 CSV로 직접 생성해 다운로드한다
 * (엑셀에서 바로 열리도록 UTF-8 BOM 포함). 화면 조립 단계는 SearchPanel과 동일한 필터로 조회한
 * "전체" 결과(페이지네이션 적용 전 or 전체 페이지 취합)를 data로 넘겨야 F012의
 * "검색결과 전체 다운로드" 의미가 성립한다.
 *
 * Phase 2 교체 지점: 이 컴포넌트의 onClick 내부만 BFF export 엔드포인트 호출
 * (예: `GET /api/inbound/export?...현재 필터` → blob 응답 저장)로 교체하면 된다.
 * props 시그니처(data/columns)는 서버 스트리밍으로 바뀌면 필요 없어질 수 있으므로,
 * 교체 시 궁극적으로는 columns(헤더 정의)만 남고 data는 서버가 현재 필터로 직접 조회하게 된다.
 */
export function ExcelDownloadButton<T>({
  data,
  columns,
  filename,
  label = "엑셀 다운로드",
  disabled,
  className,
  variant = "secondary",
  size,
}: ExcelDownloadButtonProps<T>) {
  function handleClick() {
    exportRowsToCsv(data, columns, filename);
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || data.length === 0}
      onClick={handleClick}
    >
      <Download data-icon="inline-start" />
      {label}
    </Button>
  );
}

/**
 * 행 단위 다운로드(F012) 등 버튼 UI 없이 내보내기만 필요한 곳(예: DataTable rowActions의
 * 아이콘 버튼)에서 재사용하는 순수 함수. ExcelDownloadButton과 동일한 CSV 생성 로직을 공유한다.
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
