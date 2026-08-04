/**
 * JWT exp(만료 시각, 초 단위 epoch) 읽기 — 서명 검증 없이 "언제 갱신할지" 판단에만 쓴다.
 * 토큰 검증의 책임은 Java API에 있다(위조 토큰은 어차피 서버에서 401). 페이로드가
 * JWT 형태가 아니거나 exp가 없으면 null — 호출부는 선제 갱신을 건너뛴다.
 */
export function readJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload: unknown = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (typeof payload !== "object" || payload === null) return null;
    const exp = (payload as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}
