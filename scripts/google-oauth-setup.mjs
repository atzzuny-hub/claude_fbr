#!/usr/bin/env node
/**
 * 구글 시트 내보내기용 OAuth 리프레시 토큰 1회 발급 도구 (lib/google/sheets.ts의 OAuth 모드).
 *
 * 사용법:
 *   node scripts/google-oauth-setup.mjs <OAuth 클라이언트 ID> <클라이언트 보안 비밀>
 *
 * 하는 일: 임시 로컬 서버(루프백)를 띄우고 브라우저에서 구글 동의를 받은 뒤, 리프레시 토큰을
 * 발급받아 프로젝트 루트 .env.local의 GOOGLE_OAUTH_* 3개 값을 갱신(없으면 추가)한다.
 * 동의하는 계정이 시트 소유자가 된다(그 계정 드라이브 용량 사용) — GOOGLE_DRIVE_FOLDER_ID
 * 폴더도 그 계정이 쓰기 가능해야 한다.
 *
 * 전제: GCP 콘솔에서 ① OAuth 동의 화면(외부) 구성 + "앱 게시"(테스트 상태의 리프레시 토큰은
 * 7일 뒤 만료된다) ② 애플리케이션 유형 "데스크톱 앱"으로 OAuth 클라이언트 ID 발급.
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ENV_PATH = join(dirname(dirname(fileURLToPath(import.meta.url))), ".env.local");
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/drive";

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) {
  console.error("사용법: node scripts/google-oauth-setup.mjs <OAuth 클라이언트 ID> <클라이언트 보안 비밀>");
  process.exit(1);
}

/** .env.local에서 주어진 키들을 새 값으로 교체(없으면 끝에 추가)한다. 다른 줄은 건드리지 않는다. */
function upsertEnv(values) {
  let lines = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8").split("\n") : [];
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const index = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (index >= 0) lines[index] = line;
    else lines.push(line);
  }
  // 마지막 줄 개행 보장
  if (lines[lines.length - 1] !== "") lines.push("");
  writeFileSync(ENV_PATH, lines.join("\n"));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname !== "/") {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error || !code) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h3>동의가 취소되었거나 실패했습니다: ${error ?? "code 없음"}</h3>`);
    console.error("동의 실패:", error ?? "code 없음");
    server.close();
    process.exit(1);
  }

  const redirectUri = `http://127.0.0.1:${server.address().port}`;
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => null);

  if (!tokenRes.ok || !tokenJson?.refresh_token) {
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h3>토큰 교환 실패 — 터미널 로그를 확인하세요.</h3>");
    console.error("토큰 교환 실패:", tokenRes.status, JSON.stringify(tokenJson));
    if (tokenJson && !tokenJson.refresh_token && tokenJson.access_token) {
      console.error("refresh_token이 없습니다 — 동의 URL의 prompt=consent가 빠졌거나, 이미 동의된 앱입니다.");
      console.error("구글 계정 보안 설정(제3자 앱 액세스)에서 앱 연결을 해제하고 다시 실행하세요.");
    }
    server.close();
    process.exit(1);
  }

  upsertEnv({
    GOOGLE_OAUTH_CLIENT_ID: clientId,
    GOOGLE_OAUTH_CLIENT_SECRET: clientSecret,
    GOOGLE_OAUTH_REFRESH_TOKEN: tokenJson.refresh_token,
  });

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end("<h3>완료! 이 탭은 닫아도 됩니다 — .env.local이 갱신되었습니다.</h3>");
  console.log("\n완료 — .env.local에 GOOGLE_OAUTH_* 3개 값을 기록했습니다.");
  console.log("리프레시 토큰(뒷자리):", `…${tokenJson.refresh_token.slice(-6)}`);
  console.log("dev 서버를 재시작하면 '구글 시트로 열기' 버튼이 이 계정으로 동작합니다.");
  server.close();
  process.exit(0);
});

server.listen(0, "127.0.0.1", () => {
  const redirectUri = `http://127.0.0.1:${server.address().port}`;
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline", // 리프레시 토큰 발급
      prompt: "consent", // 재실행 시에도 항상 refresh_token이 오도록 강제
    });
  console.log("브라우저에서 아래 URL을 열어 시트를 소유할 구글 계정으로 동의하세요:\n");
  console.log(authUrl + "\n");
  console.log("(미인증 앱 경고가 나오면: 고급 → 이동(안전하지 않음) 으로 계속하면 됩니다)");
  // macOS면 기본 브라우저로 자동 열기 시도 — 실패해도 위 URL을 수동으로 열면 된다.
  execFile("open", [authUrl], () => {});
});
