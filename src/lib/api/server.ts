/**
 * Java API 호출 헬퍼 — 서버 전용(미들웨어·BFF Route Handler에서만 import).
 * 배럴(index.ts)에서 재수출하지 않는다 — 경로 정의(도메인 파일)와 달리 이 파일은
 * API_BASE_URL(서버 전용 env)에 접근하므로 클라이언트 그래프에 섞이면 안 된다.
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
