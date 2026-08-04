import type { Metadata } from "next";
import { MOCK_LOGIN_PASSWORD, MOCK_LOGIN_SAMPLE_EMAIL } from "@/lib/data";
import { BrandPanel } from "./components/brand-panel";
import { LoginForm } from "./components/login-form";

export const metadata: Metadata = {
  title: "로그인 — REVE 풀필먼트 어드민",
};

/**
 * 로그인 페이지 (PRD F010, 비로그인 전용) — (main) 그룹 밖이라 AppShell 없이 렌더링된다.
 * 데스크톱: 좌 브랜드 패널 + 우 폼. lg 미만: 상단 워드마크 밴드 + 폼 단독.
 * 회원가입 경로는 없다 — 계정은 운영자가 발급한다(PRD F010).
 */
export default function LoginPage() {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <main className="flex flex-1">
      <BrandPanel />

      <section className="flex flex-1 flex-col px-6 py-8 sm:px-10">
        {/* 모바일/태블릿 워드마크 — 데스크톱은 브랜드 패널이 담당 */}
        <div className="flex items-center gap-2 lg:hidden">
          <span aria-hidden="true" className="flex items-center text-lg font-extrabold tracking-tight">
            Reve
            <span className="mx-px mt-[0.14em] size-[0.56em] rounded-full bg-primary" />
            n
          </span>
          <span className="sr-only">Reveon</span>
          <span className="rounded-md bg-secondary px-1.5 py-1 font-mono text-[10px] leading-none font-bold tracking-wider text-secondary-foreground">
            FBR V-1
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="flex w-full max-w-90 flex-col gap-8">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold tracking-tight">로그인</h1>
              <p className="text-sm text-muted-foreground">발급받은 계정으로 접속하세요.</p>
            </div>

            <LoginForm />

            <p className="text-[13px] leading-relaxed break-keep text-tertiary-foreground">
              계정은 운영자가 발급합니다. 접속에 문제가 있으면 운영 관리자에게 문의하세요.
            </p>

            {isDev && (
              <div className="rounded-lg border border-dashed bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground/70">Phase 1 데모 계정 (개발 모드에서만 표시)</p>
                <p className="mt-1 font-mono text-[11px]">
                  {MOCK_LOGIN_SAMPLE_EMAIL} / {MOCK_LOGIN_PASSWORD}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
