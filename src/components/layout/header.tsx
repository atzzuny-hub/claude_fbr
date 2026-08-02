import Link from "next/link";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Session } from "@/lib/data/session";
import { USER_ROLE_LABEL } from "@/types";
import { TopNav } from "./top-nav";

interface HeaderProps {
  session: Session;
}

/**
 * 상단바(화이트 헤더형, 레퍼런스 이미지 반영) — 좌측 Reve●n 워드마크("o"를 브랜드 보라
 * 원으로 치환) + FBR 배지, 가운데 글로벌 탑메뉴(TopNav), 우측 아바타 드롭다운으로 구성된다.
 * 현재 위치 표시는 TopNav의 활성 강조(보라 텍스트 + 언더라인)가 담당한다.
 * 사용자 정보(이름/이메일/역할)와 로그아웃은 아바타 드롭다운 안으로 이동 — 헤더 우측은
 * 레퍼런스처럼 원형 아바타 하나만 노출한다.
 *
 * 로그아웃은 Phase 1 목(mock): 실제 세션 종료 API 없이 /login으로 이동만 한다.
 * Phase 2 교체 지점: 로그아웃 아이템을 세션 종료 요청(BFF) 후 이동으로 교체.
 */
export function Header({ session }: HeaderProps) {
  const initial = session.name.slice(0, 1).toUpperCase();

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-header-border bg-header px-4 text-header-foreground sm:px-6">
      <Link
        href="/inbound"
        aria-label="Reveon FBR — 입고현황으로 이동"
        className="flex shrink-0 items-center gap-2"
      >
        <span aria-hidden="true" className="flex items-center text-lg font-extrabold tracking-tight">
          Reve
          <span className="mx-px mt-[0.14em] size-[0.56em] rounded-full bg-primary" />
          n
        </span>
        <span
          aria-hidden="true"
          className="rounded-md bg-secondary px-1.5 py-1 text-[10px] leading-none font-bold tracking-wider text-secondary-foreground"
        >
          FBR
        </span>
      </Link>

      <TopNav role={session.role} />

      <div className="flex shrink-0 items-center">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="계정 메뉴"
            className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Avatar>
              <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
                {initial}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {/* DropdownMenuLabel(=Menu.GroupLabel)은 Menu.Group 안에서만 쓸 수 있어(런타임 에러),
             * 그룹 라벨이 아닌 이 계정 정보 블록은 일반 div로 둔다 */}
            <div className="flex items-center justify-between gap-3 px-1.5 py-1">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{session.name}</span>
                <span className="truncate text-xs text-muted-foreground">{session.email}</span>
              </span>
              <Badge variant="secondary">{USER_ROLE_LABEL[session.role]}</Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/login" />}>
              <LogOut aria-hidden="true" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
