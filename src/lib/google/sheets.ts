import { createSign, randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api/server";

/**
 * 구글 시트 내보내기(서버 전용) — 사용자 확정 2026-08-05, PRD 외 추가 기능.
 * Java가 생성한 엑셀 파일을 Google Drive에 "스프레드시트로 변환" 업로드하고 그 URL을 돌려준다.
 * 시트는 지정 폴더(GOOGLE_DRIVE_FOLDER_ID) 안에 생성되며, 접근 권한은 폴더 공유 설정을 상속한다.
 *
 * 인증은 두 모드 — env 조합으로 결정하며 OAuth가 우선한다(전부 서버 전용 env, 하나의 모드가
 * 완성돼야 기능이 켜진다 — 아니면 화면이 버튼 자체를 숨긴다):
 *
 * 1) OAuth 리프레시 토큰(기본, 사용자 선택 2026-08-05): 실제 구글 계정으로 1회 동의를 받아
 *    그 계정 소유로 시트를 만든다(계정 저장용량 사용). 발급은 scripts/google-oauth-setup.mjs.
 *    - GOOGLE_OAUTH_CLIENT_ID · GOOGLE_OAUTH_CLIENT_SECRET · GOOGLE_OAUTH_REFRESH_TOKEN
 * 2) 서비스 계정(대안): **일반 드라이브 폴더에서는 동작하지 않는다** — 서비스 계정은 저장용량이
 *    0이라 파일을 소유할 수 없다(실측 2026-08-05, 403 storageQuotaExceeded). 파일을 드라이브가
 *    소유하는 **공유 드라이브(Workspace)** 폴더를 쓸 때만 유효한 모드.
 *    - GOOGLE_SA_CLIENT_EMAIL · GOOGLE_SA_PRIVATE_KEY(개행 \n 이스케이프 허용)
 *
 * 외부 SDK 없이 표준만 쓴다: 토큰 교환(refresh_token 또는 SA JWT/RS256) → Drive v3 multipart
 * 업로드. NEXT_PUBLIC 아님 — 시크릿은 서버 밖으로 나가지 않는다(원칙 4와 동일).
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink";
/** drive.file(앱 생성 파일 한정)은 미리 만들어 둔 대상 폴더를 부모로 지정할 수 없어 전체 drive 스코프를 쓴다. */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface GoogleOAuthConfig {
  kind: "oauth";
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
}

interface GoogleServiceAccountConfig {
  kind: "sa";
  clientEmail: string;
  privateKey: string;
  folderId: string;
}

type GoogleSheetsConfig = GoogleOAuthConfig | GoogleServiceAccountConfig;

function getGoogleSheetsConfig(): GoogleSheetsConfig | null {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) return null;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    return { kind: "oauth", clientId, clientSecret, refreshToken, folderId };
  }

  const clientEmail = process.env.GOOGLE_SA_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) {
    return { kind: "sa", clientEmail, privateKey, folderId };
  }
  return null;
}

/** 연동 설정 여부 — 페이지(서버)가 버튼 노출을 결정하는 스위치(DATA_SOURCE 스위치와 같은 패턴). */
export function isGoogleSheetsConfigured(): boolean {
  return getGoogleSheetsConfig() !== null;
}

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

/** 토큰 엔드포인트 공통 호출 — 실패 사유를 로그로 남기고 502로 수렴시킨다. */
async function exchangeToken(body: URLSearchParams, label: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) {
    const errBody = res ? await res.text().catch(() => "") : "(네트워크 연결 불가)";
    console.error(`[lib/google/sheets] ${label} 토큰 교환 실패: ${res ? `HTTP ${res.status}` : ""} ${errBody.slice(0, 500)}`);
    throw new ApiError(502, "구글 인증에 실패했습니다.");
  }
  const json: unknown = await res.json().catch(() => null);
  const token = (json as { access_token?: unknown } | null)?.access_token;
  if (typeof token !== "string" || !token) {
    console.error(`[lib/google/sheets] ${label} 토큰 응답에 access_token이 없습니다:`, json);
    throw new ApiError(502, "구글 인증에 실패했습니다.");
  }
  return token;
}

/** OAuth: 리프레시 토큰 → 액세스 토큰. 리프레시 토큰이 회수/만료되면 setup 스크립트로 재동의해야 한다. */
function getOAuthAccessToken(config: GoogleOAuthConfig): Promise<string> {
  return exchangeToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
    }),
    "OAuth",
  );
}

/** 서비스 계정: JWT(RS256) 자체 서명 → 액세스 토큰. */
function getServiceAccountAccessToken(config: GoogleServiceAccountConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
    "." +
    base64url(
      JSON.stringify({
        iss: config.clientEmail,
        scope: DRIVE_SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
      }),
    );
  const signature = createSign("RSA-SHA256").update(unsigned).sign(config.privateKey).toString("base64url");
  return exchangeToken(
    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    "서비스 계정",
  );
}

/**
 * 엑셀 바이너리를 구글 스프레드시트로 변환 업로드하고 웹 열람 URL을 돌려준다.
 * 연동 미설정이면 501 — 화면이 버튼을 숨기므로 정상 경로에서는 오지 않는다(방어).
 */
export async function uploadExcelAsGoogleSheet(excel: ArrayBuffer, name: string): Promise<string> {
  const config = getGoogleSheetsConfig();
  if (!config) {
    throw new ApiError(501, "구글 시트 연동이 설정되지 않았습니다(GOOGLE_* 서버 env 필요).");
  }
  const accessToken =
    config.kind === "oauth" ? await getOAuthAccessToken(config) : await getServiceAccountAccessToken(config);

  // Drive multipart 업로드 — 1부: 메타데이터(JSON, 변환 대상 mimeType), 2부: 원본 xlsx 바이트.
  const boundary = `reve-sheet-${randomUUID()}`;
  const metadata = JSON.stringify({
    name,
    mimeType: "application/vnd.google-apps.spreadsheet", // 이 mimeType가 "시트로 변환"을 의미한다
    parents: [config.folderId],
  });
  const body = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Type: ${XLSX_MIME}\r\n\r\n`,
      excel,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` },
  );

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": body.type },
    body,
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) {
    const errBody = res ? await res.text().catch(() => "") : "(네트워크 연결 불가)";
    console.error(`[lib/google/sheets] Drive 업로드 실패: ${res ? `HTTP ${res.status}` : ""} ${errBody.slice(0, 500)}`);
    throw new ApiError(502, "구글 시트 생성에 실패했습니다.");
  }
  const json: unknown = await res.json().catch(() => null);
  const file = json as { id?: unknown; webViewLink?: unknown } | null;
  if (typeof file?.webViewLink === "string" && file.webViewLink) return file.webViewLink;
  if (typeof file?.id === "string" && file.id) return `https://docs.google.com/spreadsheets/d/${file.id}`;
  console.error("[lib/google/sheets] Drive 응답에 파일 정보가 없습니다:", json);
  throw new ApiError(502, "구글 시트 생성에 실패했습니다.");
}
