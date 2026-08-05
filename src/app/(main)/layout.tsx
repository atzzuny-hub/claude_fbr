import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "REVE 풀필먼트 어드민",
};

/**
 * 로그인 후 진입하는 10개 메뉴(입고현황~업체관리)가 속하는 라우트 그룹의 레이아웃.
 * 화면 조립(screen-builder) 단계에서 이 그룹 아래에 각 메뉴 라우트(app/(main)/dtin 등)를
 * 추가하면 자동으로 AppShell(상단 탑메뉴 헤더, 사이드바 없음)이 적용된다. 그룹 폴더는 URL에
 * 영향을 주지 않는다. /login은 이 그룹 밖에 있어 셸 없이 렌더링된다.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
