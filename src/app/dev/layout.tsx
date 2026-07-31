import { AppShell } from "@/components/layout/app-shell";

/**
 * /dev/* 전용 레이아웃 — 공통 부품 데모(개발 확인용)에도 실제 셸을 적용해
 * 상단 탑메뉴 노출(OPERATOR 10개 / CLIENT 6개)과 헤더를 그대로 검증할 수 있게 한다.
 * 10개 메뉴 라우트가 속하는 "메인 라우트 그룹"과는 무관한 개발 전용 경로다.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
