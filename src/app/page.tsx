import { redirect } from "next/navigation";

/**
 * 루트(/)는 자체 화면이 없다 — 로그인 후 기본 진입 화면인 입고현황으로 보낸다(PRD).
 * Phase 2에서 인증이 붙으면 "비로그인 → /login 리디렉션"이 이 흐름 앞에 추가된다.
 */
export default function Home() {
  redirect("/dtin");
}
