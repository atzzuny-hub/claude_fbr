import { cn } from "@/lib/utils";

/**
 * 목록 화면의 공통 골격 — DataTable fillHeight가 요구하는 "높이 고정 flex 컬럼" 계약을
 * 코드로 강제한다. 루트가 셸 <main>의 높이를 모든 폭에서 그대로 채우고(h-full min-h-0),
 * 헤더·검색 슬롯은 shrink-0으로 고정, 남은 높이는 children(표 영역)이 채운다 —
 * fillHeight DataTable이면 행이 많아도 표 안에서만 스크롤된다(검색 조건이 여러 줄로
 * 감겨 표 최소 높이가 안 나오면 페이지 스크롤 폴백 — data-table.tsx fillHeight 참조).
 *
 * header는 보통 서버 page.tsx가 아니라 클라이언트 화면 컴포넌트가 렌더한다 — 헤더
 * actions(예: 검색결과 다운로드)가 현재 검색 조건(클라이언트 상태)으로 동작해야 하는데
 * RSC 경계는 함수 prop을 못 넘기고 서버 액션도 금지(원칙 7)이기 때문. 그래서 이 골격도
 * 화면 컴포넌트의 루트로 쓰는 게 기본형이다 — 참조 구현: 입고(inbound-screen.tsx).
 */
interface ListScreenLayoutProps {
  /** 페이지 헤더(PageHeader) 슬롯 — shrink-0로 고정된다 */
  header?: React.ReactNode;
  /** 검색 영역(SearchPanel) 슬롯 — shrink-0로 고정된다 */
  search?: React.ReactNode;
  /** 표 영역 — fillHeight DataTable(또는 flex-1로 남은 높이를 채우는 콘텐츠) */
  children: React.ReactNode;
  className?: string;
}

export function ListScreenLayout({ header, search, children, className }: ListScreenLayoutProps) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-4", className)}>
      {header && <div className="shrink-0">{header}</div>}
      {search && <div className="shrink-0">{search}</div>}
      {children}
    </div>
  );
}
