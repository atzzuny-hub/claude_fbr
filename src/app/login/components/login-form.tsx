"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { CircleAlert, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// 배럴(@/lib/data)이 아니라 모듈 직접 import — 배럴은 next/headers를 쓰는 세션 모듈을
// 포함해 클라이언트 번들에 넣을 수 없다(서버 컴포넌트 전용).
import { LOGIN_ERROR_MESSAGE, login } from "@/lib/data/auth";
import { loginInputSchema } from "@/types";

interface FieldErrors {
  email?: string;
  password?: string;
}

/**
 * 로그인 폼 (PRD F010) — 이메일/비밀번호 제출 → 성공 시 기본 진입 화면(/inbound)으로 이동.
 * 형식 오류는 필드 아래 인라인으로, 인증 오류(계정 없음/비밀번호 불일치)는 폼 상단
 * 알림(role="alert")으로 구분해 보여준다. Phase 2 교체 지점: lib/data/auth.login 내부만.
 *
 * 접근성 처리(리뷰 반영):
 * - 형식 오류 시 첫 오류 필드로 포커스 이동 + 인라인 오류도 role="alert" — 포커스가
 *   이미 그 필드에 있어 describedby가 재낭독되지 않는 경우(필드 안 Enter 제출)를 커버한다.
 * - 제출 버튼은 focusableWhenDisabled — 네이티브 disabled로 포커스가 body로 떨어져
 *   실패 후 키보드 사용자가 위치를 잃는 것을 막는다(재제출은 pending 가드가 차단).
 * - 비밀번호 표시 토글은 라벨 교체 방식만 사용(aria-pressed 병용 금지 — APG 토글 패턴).
 */
export function LoginForm() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // 성공 직후 이동이 굼뜨지 않도록 기본 진입 화면을 미리 받아 둔다
  useEffect(() => {
    router.prefetch("/inbound");
  }, [router]);

  function clearFieldError(field: keyof FieldErrors) {
    setAuthError(null);
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = new FormData(event.currentTarget);
    const parsed = loginInputSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      const errors = z.flattenError(parsed.error).fieldErrors;
      setFieldErrors({ email: errors.email?.[0], password: errors.password?.[0] });
      setAuthError(null);
      (errors.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    setFieldErrors({});
    setAuthError(null);
    setPending(true);
    const result = await login(parsed.data);
    if (result.ok) {
      router.push("/inbound");
      return; // 이동이 끝날 때까지 pending 유지 — 재제출 방지
    }
    setAuthError(LOGIN_ERROR_MESSAGE[result.error]);
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {authError && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2.5 text-sm font-medium text-danger-fg"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {authError}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="login-email">이메일</Label>
        <Input
          ref={emailRef}
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="name@company.com"
          className="h-10"
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
          onChange={() => clearFieldError("email")}
        />
        {fieldErrors.email && (
          <p id="login-email-error" role="alert" className="text-xs text-danger-fg">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="login-password">비밀번호</Label>
        <div className="relative">
          <Input
            ref={passwordRef}
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="비밀번호"
            className="h-10 pr-10"
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
            onChange={() => clearFieldError("password")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
        </div>
        {fieldErrors.password && (
          <p id="login-password-error" role="alert" className="text-xs text-danger-fg">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <Button
        type="submit"
        className="mt-1 h-10 w-full aria-disabled:pointer-events-none aria-disabled:opacity-50"
        disabled={pending}
        focusableWhenDisabled
        aria-busy={pending}
      >
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        로그인
      </Button>
    </form>
  );
}
