/**
 * BFF 전용 Java API 호출 헬퍼 — 이 파일은 Route Handler(서버)에서만 import한다.
 * API_BASE_URL은 서버 전용 환경변수(.env.local / .env.production)이며 NEXT_PUBLIC_
 * 접두사를 절대 붙이지 않는다(CLAUDE.md 원칙 4). 경로는 lib/api의 *_API 상수만 쓴다.
 */

export function javaApiUrl(path: string): string {
  const base = process.env.API_BASE_URL;
  if (!base) {
    throw new Error("API_BASE_URL 환경변수가 없습니다 — .env.local(dev)/.env.production을 확인하세요.");
  }
  return `${base.replace(/\/+$/, "")}${path}`;
}

/** JSON POST 공통 래퍼 — 네트워크 실패는 null로 수렴시켜 호출부가 502로 응답하게 한다 */
export async function postJavaApi(path: string, body: unknown): Promise<Response | null> {
  return fetch(javaApiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  }).catch(() => null);
}
