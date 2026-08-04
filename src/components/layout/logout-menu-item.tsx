"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
// 배럴(@/lib/data)은 서버 전용(세션 모듈이 next/headers 의존) — 클라이언트는 모듈 직접 import.
import { logout } from "@/lib/data/auth";

/**
 * 헤더 아바타 드롭다운의 로그아웃 항목 — BFF 로그아웃(쿠키 3종 삭제) 후 로그인 페이지로
 * 즉시 이동한다(PRD: 로그아웃은 별도 화면 없는 액션). router.refresh로 서버 컴포넌트
 * 캐시에 남은 세션 표시(헤더 이름 등)도 함께 무효화한다.
 */
export function LogoutMenuItem() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <DropdownMenuItem
      disabled={pending}
      onClick={async () => {
        if (pending) return;
        setPending(true);
        await logout();
        router.push("/login");
        router.refresh();
      }}
    >
      <LogOut aria-hidden="true" />
      로그아웃
    </DropdownMenuItem>
  );
}
