# CLAUDE.md — REVE 풀필먼트 어드민 재구축

## 프로젝트 개요

기존 운영 중인 REVE 시스템(동남아 풀필먼트 어드민)을 Next.js 프론트엔드로 재구축한다.
백엔드는 기존 Java(Spring Boot) API가 유일한 데이터 소스이며 **이 저장소의 작업 범위가 아니다**.
상세 요구사항은 `docs/PRD.md` 참조. 이 문서와 PRD가 충돌하면 임의 판단하지 말고 사용자에게 보고한다.

## 확정 용어 (변경 금지)

- 화주/셀러 → **클라이언트**로 통일한다
- 메뉴 10개: 입고현황, 출고현황, 반품현황, 재고현황, SKU, NEW, WMS, 클라이언트, 사용자, 업체관리
  (정산은 이번 재구축 범위에서 제외 — 구현 금지)
- 상태 명칭 (표시명 임의 변경 금지):
  - NEW 요청: `제출됨 → WMS 등록 대기 → 등록 완료`
  - 입고: `예정 → 대기 → 작업중 → 입고` — 코드값: `PLAN → STANDBY → WORK → COMPLETED`,
    취소 = `CANCELED`. **WORK=작업중은 사용자 확정(2026-08-05)** — 문서상 없는 값으로
    알려졌다가 실데이터 실측으로 정식 편입(파이프라인 내 위치는 흐름상 대기·입고 사이로
    배치한 설계값). 응답 전용 `UNKNOW`(원본 코드 매핑 실패, API 표기 그대로)는
    `알 수 없음`으로 표시하고 필터 옵션에는 넣지 않는다
  - **취소**: 입고·출고·반품 공통의 종료 상태(사용자 확정 추가). 순차 파이프라인 밖의 값이라
    취소 행은 진행 단계 대신 붉은 X 단일 노드 `취소`만 표시한다(목록 배지는 붉은 톤).
    기존 진행 라벨은 그대로 유지하며, 출고/반품의 진행 라벨 자체는 여전히 설계값(확인 필요)
- NEW 메뉴 = 클라이언트가 해외 WMS 담당자에게 요청(상품등록·사은품 등록·라벨 생성 등)을
  제출하는 곳. WMS 쓰기 API는 없으며 이메일 기반 수동 처리(휴먼 인 더 루프)
- **계층: WMS(=화면의 WMS LINK) 1 : 클라이언트(마켓) N** — WMS 메뉴에서 해외 WMS를 등록·연동하면, 그 WMS에 등록된 마켓 목록이 클라이언트 메뉴로 동기화된다 (수기 생성 아님, 계정 발급은 사용자 메뉴 ※추정)

## 사용자 역할 & 데이터 스코핑

- **내부 운영자**: 전체 데이터 + 클라이언트·국가(PH/MY/VN 등)·WMS LINK 필터 제공
- 필터는 계층적: WMS LINK 선택 시 클라이언트 필터 옵션은 해당 WMS 소속 마켓으로 좁혀진다
- **클라이언트**: 본인 소유 마켓 데이터 자동 스코핑 — **계정 1 : 마켓 N 확정**(로그인 응답
  `webClientIds` 목록, 상위 권한은 NULL · 사용자 확인 2026-08-04). 클라이언트 선택 필터 UI를
  렌더링하지 않는다. 역할은 `auth` 레벨에서 매핑: **LV1 = 운영자(확정)**, LV2~LV9 의미
  미확정 — 확정 전까지 비-LV1은 전부 CLIENT로 취급(보수 기본값, `resolveRoleFromAuthLevel`)
- 스코핑 강제는 서버(BFF)에서 처리한다. 브라우저 사이드 필터링으로 대체 금지
- 운영자 전용 메뉴: WMS, 클라이언트, 사용자, 업체관리
- 인증은 로그인/로그아웃만. 회원가입 없음(운영자가 클라이언트 계정 발급)

## 아키텍처 원칙

1. 모든 데이터 접근은 `lib/data`의 함수를 경유한다 — 컴포넌트에서 fetch 직접 호출 금지
2. `lib/data` 내부만 목 → 실 Java API 호출로 교체한다(호출부 불변).
   **인증·세션 실전환 완료**(2026-08-04, `app/api/auth/*` + httpOnly 쿠키) ·
   **입고 목록·건수 실전환 완료**(2026-08-05, 서버 env `DATA_SOURCE=api`일 때 —
   미설정/`mock`이면 목 폴백, 도메인별 전환 스위치 컨벤션). RSC가 lib/data를 서버에서
   직접 호출하는 조회 경로는 별도 Route Handler 없이 `lib/api/server.ts` 경유로 Java를
   호출한다(브라우저→Java 직접 호출은 여전히 불가). 나머지 도메인은 목이며 순차 교체
3. 브라우저 → Java API 직접 호출 금지. 반드시 Next.js Route Handler(BFF) 경유
4. `API_BASE_URL`은 서버 전용 환경변수 — `NEXT_PUBLIC_` 접두사 사용 금지
5. 인증/세션 토큰을 localStorage·sessionStorage에 저장하지 않는다 (httpOnly 쿠키 기반)
6. **목록 검색 조건(필터·페이지·정렬)은 URL 쿼리에 싣지 않는다**(사용자 확정 2026-08-05) —
   URL은 메뉴 경로로 고정(`/dtin` 등 — 라우트명은 Java API 경로와 통일, 사용자 확정 2026-08-05). 첫 진입은 페이지(서버)가 기본 조건(입고: 최근
   1주·1페이지)으로 조회해 내려주고, 이후 조회·페이지·정렬은 클라이언트 상태 +
   **axios → 데이터 BFF Route Handler**(`app/api/dtin/route.ts` 패턴, 쿼리는 zod
   재검증, BFF가 lib/data 경유)로 갱신한다. **BFF의 요청·응답 계약은 Java Req/Res와
   그대로 통일**(사용자 확정 2026-08-05 — devtools에서 보이는 것이 곧 Java 계약):
   - 요청: `startDt`/`endDt`(epoch 초) · `searchDt` · `status` · `search` ·
     `pageNo`(0-기반) · `pageSize` · `wmsLinkId`(전체 = -100 항상 전송) —
     `sort`/`order`만 Req에 없는 프런트 전용. 날짜 문자열→epoch 변환은 화면
     (`toEpochSeconds`, lib/utils/datetime)이 한다.
   - 응답: 목록 = **Res 그대로의 행 배열**(무변환 중계 — sipDt 등 미사용 필드 포함,
     행 스키마 검증만) · 건수 = 별도 `GET /api/dtin/cnt`(숫자 그대로). 화면은
     레거시 관례대로 **첫 페이지(pageNo 0) 조회에만 건수를 함께 부르고**, 페이지
     이동 시엔 직전 total을 유지한다. 정규화(초→ms · 0→null · 미확정 status 강등)와
     페이지 내 재정렬은 받는 쪽 공용 변환(types/inbound.ts `wireInboundSchema` ·
     `toDomainInbound` · `inboundSortValue`)으로 화면·lib/data(SSR)가 공유한다.
   SearchPanel은 `basePath` 생략 시 이 상태 모드로 동작한다. 새로고침 시 기본 조건으로 초기화되고 조건 딥링크는 지원하지 않는다
   (레거시 SPA 동일 — 의도된 트레이드오프). 다른 목록 화면도 실연동 시 같은 패턴으로
   전환한다(현재 목 화면들은 URL 모드 잔존)
7. **Server Action을 쓰지 않는다**(사용자 확정 2026-08-05, 레거시 스타일 계승) —
   브라우저發 데이터 조회·뮤테이션은 전부 axios → Route Handler(BFF) HTTP 호출로 한다.
   비로그인 응답은 401 JSON(BFF)이고 리디렉션은 호출부(화면)가 담당한다

## 디렉터리 구조

```
src/
├── app/            # App Router 라우트 (app/api/auth = 인증 BFF · app/api/dtin = 입고 데이터 BFF, 도메인별 순차 추가)
├── components/
│   ├── ui/         # shadcn 생성 컴포넌트 (직접 수정 최소화)
│   └── common/     # 공통 부품: SearchPanel, DataTable, StatusStepper, ExcelDownloadButton
├── lib/
│   ├── api/        # Java API 엔드포인트 정의(*_API 상수, 확정분만) + server.ts(서버 전용 호출 헬퍼 — BFF·프록시·lib/data)
│   ├── auth/       # 인증 공유 모듈(쿠키 상수·JWT exp 디코드) — next 런타임 무의존(프록시와 공유)
│   ├── data/       # 데이터 접근 함수 — Phase 2 교체 지점
│   ├── google/     # 구글 시트 내보내기(서버 전용 — 서비스 계정 Drive 변환 업로드)
│   ├── mock/       # 목데이터 (JSON/TS)
│   └── utils/
├── proxy.ts        # 액세스 토큰 선제 갱신(Next 16 프록시 — 구 미들웨어 컨벤션)
└── types/          # 도메인 타입 · zod 스키마 · 상태 enum — 단일 출처(source of truth)
```

## 메뉴 ↔ 라우트 ↔ 타입 매핑 (잠정 — 변경 시 이 표만 수정)

| 메뉴 | 라우트 | 도메인 타입 | 접근 권한 |
|------|--------|------------|----------|
| 로그인 | /login | — | 비로그인 |
| 입고현황 | /dtin | Inbound | 공통(데이터 스코핑) |
| 출고현황 | /dtob | Outbound | 공통(데이터 스코핑) |
| 반품현황 | /returns | Return | 공통(데이터 스코핑) |
| 재고현황 | /inventory | InventoryItem | 공통(데이터 스코핑) |
| SKU | /sku | Sku | 공통(데이터 스코핑) |
| NEW | /requests | WmsRequest | 공통(제출은 클라이언트, 운영자는 전체 조회) |
| WMS | /wms | WmsLink | 운영자 전용 |
| 클라이언트 | /clients | Client | 운영자 전용 |
| 사용자 | /users | User | 운영자 전용 |
| 업체관리 | /vendors | Vendor | 운영자 전용 |

- 메뉴 표시명은 위 한국어(및 SKU/NEW/WMS)를 그대로 사용 — 라우트명은 코드 내부용
- 로그인 후 기본 진입: `/dtin` (입고현황)
- 클라이언트 소유 모델(Outbound, Return, InventoryItem, Sku, WmsRequest)에는
  `client_id` 귀속 필드 필수. 물류 모델에는 국가·WMS LINK 필드 포함
  (실제 필드명은 Swagger 확인 후 통일 — 그 전까지 잠정 표기)
- **Inbound는 Swagger 확정**: 응답 스키마를 그대로 쓴다(`idx`/`ganNo`/`clntName`/`cntyCd`/
  `wmsLinkId(int)`). 도메인 모델의 날짜는 UTC epoch ms — 단 **실서버 와이어는 epoch 초 ·
  값 없음 = 0 · 문서 밖 status(WORK) 실측**(2026-08-05)이라 lib/data/inbounds.ts가
  ms·null·확정 enum으로 정규화한다. 국가도 문서 밖 값이 실재(**SG 실측 → 정식 추가**,
  COUNTRY 4개국) — 입고 행의 cntyCd는 열린 문자열로 두고 표시가 폴백한다(`countryLabel`).
  행에 클라이언트 ID가 없으므로(clntName뿐)
  CLIENT 격리는 서버 스코핑 전제 — Phase 1 목은 lib/data가 이름으로 잇는다
- Client(마켓) 모델은 wmsLinkId로 소속 WMS에 귀속 (WmsLink 1 : Client N) — country는 WmsLink 속성, 물류 행에는 표시용 포함

## 기술 스택

- Next.js 16 (App Router) · TypeScript · TailwindCSS v4 · shadcn/ui · Lucide
- React Hook Form + Zod (폼/검증) · npm
- `@tanstack/react-virtual` — DataTable 행 가상화(화면에 보이는 행만 렌더).
  기본 표시 건수가 500이라 한 페이지의 `<tr>`을 한꺼번에 그리면 첫 렌더가 느려지는 문제 때문에 도입.
  `components/common/data-table.tsx`에서만 사용하며, 툴바 토글로 끌 수 있다
- Server Component 기본, 상호작용 필요한 곳만 `'use client'`
- `next.config.js`: `output: 'standalone'` 유지 (Docker 배포 전제)

## 목데이터 규칙

- 국가(PH/MY/VN), WMS LINK(예: REVE VN (FEI), PH Pharma Research), client_id 귀속을
  반영한 현실적인 데이터로 작성 — 상태별(예정만 체크/전체 완료 등) 다양한 조합 포함
- 목데이터 스키마는 `types/`의 타입을 그대로 따른다 (별도 형태 금지)

## 금지 사항 (위반 시 작업 중단 후 보고)

- Java/Spring 코드 생성·수정, 백엔드 저장소 관련 작업
- 메뉴 신설·삭제·개명, 상태 표시명 변경, '셀러' 용어 사용
- 정산 기능 구현
- `lib/data`를 우회한 데이터 접근, 컴포넌트 내 하드코딩 데이터
- 스펙(엔드포인트·인증 방식·응답 형태) 미확정 도메인의 실 API 연동 임의 착수, Docker/CI 작업 착수
- 아래 TBD 항목을 임의로 확정하는 것

## 미확정 (TBD) — 필요 시 사용자에게 질문

- **구글 시트 내보내기(PRD 외 신규 — 사용자 요청 2026-08-05, PRD 반영 필요)**: 입고 검색결과
  엑셀(/dtin/dn)을 Google Drive에 시트 변환 업로드 후 새 탭으로 연다
  (`lib/google/sheets` · BFF `GET /api/dtin/dn/sheet` · 공용 `GoogleSheetButton`).
  `GOOGLE_DRIVE_FOLDER_ID` + 인증 env가 있어야 버튼이 노출된다(실 API 모드 전제).
  인증은 2모드(OAuth 우선):
  ① **OAuth 리프레시 토큰(기본 — 사용자 선택 2026-08-05)**: 실제 계정 소유로 시트 생성.
  `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET`/`_REFRESH_TOKEN` — 발급은 `scripts/google-oauth-setup.mjs`
  (데스크톱 앱 클라이언트 + 루프백 1회 동의, 동의 화면은 "게시" 상태여야 토큰이 안 죽음)
  ② 서비스 계정(`GOOGLE_SA_*`): **일반 드라이브에선 불가 확정** — 서비스 계정 저장용량 0
  (실측 2026-08-05, 403 storageQuotaExceeded). 공유 드라이브 폴더 전제의 대안 모드.
  조직(reve-on.com) 정책이 SA 키 생성도 차단해 개인 계정 GCP 프로젝트(reve-sheet-export)로
  우회 중. **남은 확인**: ① 생성된 시트 정리(보존) 정책 ② 운영 시 회사 계정/공유 드라이브로
  이전 여부 ③ PRD 반영
- 인증: JWT 확정 + 엔드포인트 3종 확정(사용자 제공 2026-08-04, `lib/api/auth.ts`):
  POST `/auth/login`(Req email/password → Res에 accessToken·refreshToken·auth 레벨 등) ·
  `/auth/logout`(Req refreshToken → true) · `/auth/token`(재발급). 토큰은 응답 바디로 오며
  브라우저에는 BFF가 httpOnly 쿠키로만 심는다(원칙 5 — JS 접근 토큰 금지).
  `auth` 레벨은 LV1~LV9 존재, **LV1 = 운영자 확정**(사용자 확인) — 비-LV1은 CLIENT로
  보수 매핑 중(LV2~LV9 의미 확정 시 `resolveRoleFromAuthLevel`만 갱신).
  **남은 확인**: ① ~~`/auth/token` 응답 형태~~ → 확정(레거시 useAjax로 확인): 로그인 응답과
  동일 형태 + **리프레시 토큰 매번 회전** — `src/proxy.ts`가 액세스 토큰 exp 임박 시
  선제 갱신한다(같은 토큰 동시 갱신은 single-flight로 합침, 실패 시 쿠키 삭제 후 로그인으로)
  ② LV2~LV9의 의미 ③ 토큰 만료 정책 문서화(현재는 JWT exp 클레임 기반 대응, 쿠키는
  브라우저 세션 수명) ④ ~~로그인 401 오류 구분~~ → 구분 불가 확정: 실패는 401(빈 바디)
  또는 500+errorCode 1006 두 형태(레거시 확인)이며 화면은 단일 문구 "이메일 또는
  비밀번호가 잘못되었습니다."(레거시 문구 계승) — **PRD F010(오류 2종)과 어긋나 PRD 갱신
  필요(사용자 보고됨)**. Java errorCode 카탈로그는 `JAVA_API_ERROR_CODE`(types/common.ts)
- ~~Java API 응답 래핑 형태~~ → **성공 응답도 전역 래핑 없음 확정**(2026-08-05, 레거시
  useAjax 확인): `getSync`가 `Promise<AxiosResponse>`를 반환하고 화면이 `res.data`
  (=HTTP 바디)를 그대로 사용 — 바디가 곧 페이로드. `/dtin` = 행 배열, `/dtin/cnt` = 숫자.
  부수 확정(레거시 관례): 목록 페이지 파라미터는 **0-기반**(`pageNo === 0`이 1페이지),
  건수는 1페이지 요청일 때만 조회. Swagger 문서 자체는 여전히 미확보(확정분은 사용자 제공)
- NEW 제출 시 이메일 발송 주체(Java API vs Next.js Route Handler)
- 다국어(i18n) 적용 여부, Nginx/HTTPS 구성
- ~~클라이언트 로그인 계정 ↔ 마켓 관계~~ → **1:N 확정**(사용자 확인 2026-08-04):
  `webClientIds` = 접근 가능한 WMS 클라이언트 ID 목록(기본 권한 이하만 사용, 상위 권한은
  NULL). 세션·스코핑은 `clientIds: string[] | null`로 반영됨(`resolveClientScope`).
  스펙 예시가 배열 모양 문자열(`"['aaaa', 'bbbb']"`)이라 실제 타입만 실 응답으로 확인 필요
  (`parseWebClientIds`가 문자열/배열 모두 수용)
- **목록 화면의 운영자용 클라이언트·국가 필터 노출 여부 (입고는 확정, 나머지 보류)**
  PRD F013과 위 「사용자 역할」은 운영자에게 클라이언트·국가·WMS LINK 필터 제공을 명시하지만,
  **입고현황은 Swagger 확정으로 미노출이 결론** — 목록 Req에 클라이언트·국가 파라미터가 없다
  (wmsLinkId·기간·searchDt·status·search·페이지뿐). 나머지 5개 목록 화면은 각자 Swagger
  확인 시 결정한다.
  - 결정 전까지 이 상태를 PRD 위반으로 보지 않는다(리뷰 시 재지적 대상 아님 — PRD F013과의
    차이는 PRD 갱신 필요 사항으로 사용자에게 보고됨)
  - 데이터 격리와는 무관: CLIENT 자동 스코핑은 `resolveClientScope`로 서버에서 이미 강제됨
- **입고 목록 API 확인 필요 사항 (Swagger 재확인 대상)**
  - ~~epoch 단위 불일치~~ → 확정: `startDt/endDt`는 날짜+시:분 정밀도의 datetime(사용자 확인,
    예시 epoch 10자리=초 단위) — 단, 검색 패널 입력은 **날짜만** 받는다(사용자 확정: 시간
    불필요). 조회 시 시작일 00:00 · 종료일 23:59로 확장해 datetime 정밀도로 매핑한다
  - ~~searchDt 전체 허용값~~ → 확정(사용자 확인): 입고접수일 `REQ_DT` · 창고도착일 `WRHS_DT` ·
    입고완료일 `CMPL_DT`
  - `CMPL_DT`(입고완료일)는 검색 기준으로 존재하지만 **응답에 완료일 필드가 없다** —
    응답 스키마 누락인지 재확인 필요(목 필터는 완료 행의 마지막 변경 시각으로 근사 중)
  - `etaDt/arvDt`의 nullable 여부 — 명세엔 표기 없으나 미도래 단계는 값이 없어야 정상
  - ~~sipDt(배송일)~~ → 제거 확정(사용자 확인: 이제 안 씀) — 타입·목·화면·CSV 전부에서
    뺐고, 응답에 남아 있어도 무시한다
  - ~~목록 응답의 total~~ → 확정: 전체 건수는 별도 엔드포인트 `/dtin/cnt`(Req는 목록과
    동일한 필터, 페이지 파라미터 없음)
  - ~~목록 엔드포인트 경로~~ → 확정(사용자 확인): 목록 GET `/dtin` · 건수 `/dtin/cnt` ·
    검색결과 전체 엑셀 `/dtin/dn` · 행 상세 엑셀 `/dtin/dn/{idx}`(사용자 재확정 2026-08-05) —
    정의는 `lib/api/inbound.ts`(INBOUND_API)가 단일 출처. 엑셀은 서버 생성 파일 엔드포인트라
    Phase 1의 클라이언트 CSV 생성은 Phase 2에 서버 다운로드로 교체한다 — **행 상세·검색결과
    전체 모두 교체 완료**(2026-08-05, 파일 BFF `app/api/dtin/dn`·`dn/[idx]`가 스트리밍 중계 ·
    **/dn Req는 목록(/dtin)과 완전 동일 계약(필터+pageNo/pageSize 필수 — 사용자 제공 Req로
    확정, 건수 /cnt처럼 페이지가 없는 게 아님)** · "전체"는 pageNo 0+EXPORT_MAX_ROWS(1000)로
    표현 · DATA_SOURCE=api일 때만이고 목 폴백은 CSV 유지).
    전역 래핑: **에러 응답은 래핑이 아님을 프로브로 확인**(2026-08-04) —
    `{ timestamp, path, status, error, requestId, errorCode }` 형태(`javaApiErrorSchema`).
    ~~성공 응답의 래핑 여부~~ → **비래핑 확정**(2026-08-05, 레거시 useAjax 확인 —
    위 「Java API 응답 래핑 형태」 항목 참조)
  - ~~카운트 API 문서의 `WORK`는 실재하지 않는 값(사용자 확인)~~ → **실재 확인 후 정식
    편입 완료**(실측 18건·원본코드 20 → 사용자 확정 2026-08-05: 표시명 `작업중`).
    상태 enum·필터·스테퍼에 반영됨 — 문서 밖 상태가 또 오면 여전히 UNKNOW로 강등된다
    (`toDomainInbound`, warn 로그)
  - **CLIENT 토큰 스코핑(신규·중요)**: /dtin Req에 클라이언트 파라미터가 없어 실 API 경로는
    Java가 액세스 토큰으로 스코핑한다고 추정 중(`getApiInbounds`는 resolveClientScope
    미사용) — 미확정. CLIENT 계정 실 로그인으로 타 클라이언트 행이 안 보이는지 확인 필수
    (스코핑이 안 되면 보안 이슈 — 백엔드 확인 요청)
  - 목록 Req에 정렬 파라미터가 없어 응답 페이지 안에서만 재정렬 중(기본 500건이라 실사용
    영향 작음) — Java에 sort 파라미터 실재 여부 확인 필요
  - ~~시간대~~ → **확정(사용자 2026-08-05, 두 축)**: ① **데이터 축은 UTC epoch**
    (와이어 초 → 도메인 ms). Req의 startDt/endDt 경계도 **UTC 자정 기준**
    (`toEpochSeconds`, Date.UTC 조립 — 레거시 캡처의 startDt가 정확히 UTC 자정,
    Java 비교 축과 동일해야 같은 검색 결과). ② **표시와 "오늘"은 KST(+9 고정)** —
    formatEpoch*가 +9 오프셋 후 표기(레거시 어드민과 동일: UTC 02:22 → 화면 11:22),
    기본 기간 "오늘"도 KST 달력(`recentPeriodKst`). 고정 오프셋인 이유: SSR·브라우저
    양쪽 렌더라 실행 환경 시간대(toLocaleString)를 쓰면 하이드레이션이 어긋난다.
    표시는 KST·경계는 UTC 자정인 비대칭은 레거시 동작의 계승(의도된 것)
  - **필수 파라미터 확정(실서버 프로브 2026-08-05)**: `startDt`·`endDt`·`searchDt`는
    /dtin·/dtin/cnt 공통 필수(하나라도 빠지면 400, 바디에 errorCode 없음) ·
    /dtin은 `pageNo`·`pageSize`도 필수 · 선택은 status/search뿐.
    `startDt=0`도 400으로 거부 — 기간 미입력 시 lib/data가 "전체 기간" 대용으로
    최광역 범위(epoch 초 1 ~ 2100-01-01)를 보낸다(`FULL_RANGE_*`, UI 의미 불변).
    ~~레거시 화면의 기본 검색 기간 확인 필요~~ → **확정(사용자 2026-08-05): 첫 진입
    (URL에 기간 없음) 기본 기간 = 최근 1주** — 입고 page.tsx가 서버에서 오늘-7일~오늘
    (UTC)로 채워 목록 적용 조건과 검색 패널 표시를 일치시킨다(레거시 캡처와 동일 규칙.
    참고: 레거시 pageSize는 300, 우리는 500 유지)
  - **WMS LINK 필터 옵션 = GET `/wmslkmap` 확정**(사용자 제공 2026-08-05): Req 파라미터
    없음 · Res `{name, idx}` 배열(name 오름차순, 실측 41건 — TH 등 신규 국가 링크 포함).
    정의는 `lib/api/wms.ts`(WMS_API.linkMap), 호출은 `getWmsLinkOptions`(lib/data/wms-links,
    DATA_SOURCE=api 스위치 동일 적용). WMS 메뉴 자체는 여전히 목
  - **`wmsLinkId=-100` = 전체 조회 센티널(레거시 캡처 확정 2026-08-05)**: wmsLinkId를
    아예 빼면 에러가 아니라 **조용히 0건**이 온다(함정) — lib/data가 미선택 시 -100을
    보낸다(`WMS_LINK_ALL`). 이 센티널로 전체 10,298건(2020~) 확인 — "실서버 0건" 소동의
    원인이었음. 종료 경계는 레거시와 동일한 23:59:59
  - epoch 단위 **실증 확정(2026-08-05)**: Req의 startDt/endDt·응답 날짜 모두 epoch "초"
    (레거시 캡처 + 실데이터 대조). 응답이 문서 표기(ms)와 달라 lib/data가 초→ms 정규화

## 개발 단계

- **Phase 1 (종료)**: 타입·목데이터 → 공통 컴포넌트 → 입고현황·로그인 조립까지 완료
- **Phase 2 (현재 — 사용자 확정 2026-08-04로 조기 착수)**: JWT 인증 + 확정 도메인(입고)부터
  BFF(Route Handler) 연동 → 실데이터 검증 후, 나머지 메뉴는 실 API 기반으로 조립한다
  (화면 전부 목으로 먼저 만드는 원계획을 사용자 지시로 변경). Docker/CI/배포는 후순위.
  연동 착수 전 선행 확인 필수: 인증 API 스펙 · 응답 전역 래핑 여부 · dev에서 접근 가능한
  API_BASE_URL(주의: `next dev`는 `.env.production`을 읽지 않는다 — `.env.local` 필요)
  → 3종 모두 확정 완료(2026-08-05). 진행 현황: 인증 완료 → **입고 목록·건수 실연동 +
  런타임 검증 완료**(2026-08-05, 실 로그인으로 전체 10,298건 렌더·기간 113건·취소 17건이
  API 직접 호출 대조값과 일치 — CLIENT 계정 스코핑 검증만 남음) → **WMS LINK 필터
  실연동(/wmslkmap)·WORK 상태 편입·기본 기간 1주 적용·검색 조건 URL 제거(axios→데이터
  BFF 전환, 원칙 6·7 — 서버 액션 금지)**(2026-08-05) → **입고 엑셀 서버 다운로드 전환
  완료**(2026-08-05, 행 상세 GET `/api/dtin/dn/{idx}` · 검색결과 전체 GET `/api/dtin/dn`
  파일 BFF — 목 폴백은 CSV 유지) → **구글 시트 내보내기 추가**(2026-08-05, PRD 외
  사용자 요청 — 아래 TBD 참조) → 나머지 도메인(다음: 출고 `/dtob`) 순

## 명령어

```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드 (standalone)
npm run lint     # 린트
```