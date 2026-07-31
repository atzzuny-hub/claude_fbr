import { getSession } from "@/lib/data";
import { Header } from "./header";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * 로그인 후 화면의 공통 셸(상단 탑메뉴 헤더 + 콘텐츠 캔버스).
 * 좌측 사이드바 없이 헤더 하나로 내비게이션(TopNav)과 콘텐츠를 분리한다 — 콘텐츠 영역은
 * 사이드바가 차지하던 폭까지 포함해 항상 뷰포트 가용 폭 100%를 사용한다.
 * 세션은 서버에서 조회해 role만 클라이언트 컴포넌트로 내려준다 — NAV_ITEMS는 lucide 아이콘
 * (컴포넌트 참조)을 포함해 서버→클라이언트 props로 직렬화할 수 없으므로, 메뉴 필터링 자체는
 * Header 내부의 TopNav(클라이언트)가 role을 받아 직접 수행한다.
 *
 * 화면 조립(screen-builder) 단계에서는 각 라우트 그룹의 layout.tsx가 이 컴포넌트로
 * children을 감싸기만 하면 된다 — 개별 메뉴 페이지는 셸을 신경 쓸 필요가 없다.
 */
export async function AppShell({ children }: AppShellProps) {
  const session = await getSession();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <Header session={session} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
