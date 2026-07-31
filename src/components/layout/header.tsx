import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Session } from "@/lib/data/session";
import { USER_ROLE_LABEL } from "@/types";
import { TopNav } from "./top-nav";

interface HeaderProps {
  session: Session;
}

/**
 * 상단바(컬러 헤더형, 솔루션 디자인 템플릿 §4.1 변형 A) — 좌측 로고, 가운데 글로벌 탑메뉴
 * (TopNav), 우측 사용자 정보 + 로그아웃으로 구성된다.
 * 예전 "REVE / 메뉴명" 브레드크럼은 탑메뉴의 활성 강조(언더라인/볼드)가 현재 위치를 대신
 * 나타내므로 제거했다 — 페이지 자체의 보조 브레드크럼이 필요하면 PageHeader의
 * `breadcrumbs` prop(선택)을 화면 조립 단계에서 사용한다.
 *
 * 로그아웃은 Phase 1 목(mock): 실제 세션 종료 API 없이 /login으로 이동만 한다.
 * Phase 2 교체 지점: 클릭 핸들러 내부를 세션 종료 요청(BFF)으로 교체.
 */
export function Header({ session }: HeaderProps) {
  const initial = session.name.slice(0, 1).toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-header-border bg-header px-4 text-header-foreground sm:px-6">
      <Link href="/inbound" className="flex shrink-0 items-center gap-2">
        <span className="text-lg font-semibold tracking-tight">REVE</span>
        <span className="hidden text-xs font-medium text-header-foreground/60 md:inline">
          풀필먼트 어드민
        </span>
      </Link>

      <TopNav role={session.role} />

      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden items-center gap-2.5 sm:flex">
          <Avatar size="sm" className="bg-white/15">
            <AvatarFallback className="bg-transparent text-header-foreground">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium">{session.name}</span>
            <span className="text-xs text-header-foreground/60">{session.email}</span>
          </div>
          <Badge variant="secondary" className="bg-white/15 text-header-foreground">
            {USER_ROLE_LABEL[session.role]}
          </Badge>
        </div>

        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          className="text-header-foreground hover:bg-white/10 hover:text-header-foreground"
          render={
            <Link href="/login">
              <LogOut data-icon="inline-start" />
              로그아웃
            </Link>
          }
        />
      </div>
    </header>
  );
}
