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
  - 입고: `예정 → 대기 → 입고` — 코드값 Swagger 확정: `PLAN → STANDBY → COMPLETED`,
    취소 = `CANCELED`. 응답 전용 `UNKNOW`(원본 코드 매핑 실패, API 표기 그대로)는
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
- **클라이언트**: 본인 클라이언트(마켓) 데이터 자동 스코핑(계정 1:1 ※잠정) — 클라이언트 선택 필터 UI를 렌더링하지 않는다
- 스코핑 강제는 서버(BFF)에서 처리한다. 브라우저 사이드 필터링으로 대체 금지
- 운영자 전용 메뉴: WMS, 클라이언트, 사용자, 업체관리
- 인증은 로그인/로그아웃만. 회원가입 없음(운영자가 클라이언트 계정 발급)

## 아키텍처 원칙

1. 모든 데이터 접근은 `lib/data`의 함수를 경유한다 — 컴포넌트에서 fetch 직접 호출 금지
2. **Phase 1(현재)**: `lib/data`는 `lib/mock`의 목데이터를 반환한다
   **Phase 2**: `lib/data` 내부만 BFF(Route Handler) → Java API 호출로 교체한다
3. 브라우저 → Java API 직접 호출 금지. 반드시 Next.js Route Handler(BFF) 경유
4. `API_BASE_URL`은 서버 전용 환경변수 — `NEXT_PUBLIC_` 접두사 사용 금지
5. 인증/세션 토큰을 localStorage·sessionStorage에 저장하지 않는다 (httpOnly 쿠키 기반)

## 디렉터리 구조

```
src/
├── app/            # App Router 라우트 (Phase 2에 app/api = BFF 추가)
├── components/
│   ├── ui/         # shadcn 생성 컴포넌트 (직접 수정 최소화)
│   └── common/     # 공통 부품: SearchPanel, DataTable, StatusStepper, ExcelDownloadButton
├── lib/
│   ├── api/        # Java API 엔드포인트 정의(도메인별 *_API 상수, 확정분만) — Phase 2 BFF가 사용
│   ├── data/       # 데이터 접근 함수 — Phase 2 교체 지점
│   ├── mock/       # 목데이터 (JSON/TS)
│   └── utils/
└── types/          # 도메인 타입 · zod 스키마 · 상태 enum — 단일 출처(source of truth)
```

## 메뉴 ↔ 라우트 ↔ 타입 매핑 (잠정 — 변경 시 이 표만 수정)

| 메뉴 | 라우트 | 도메인 타입 | 접근 권한 |
|------|--------|------------|----------|
| 로그인 | /login | — | 비로그인 |
| 입고현황 | /inbound | Inbound | 공통(데이터 스코핑) |
| 출고현황 | /outbound | Outbound | 공통(데이터 스코핑) |
| 반품현황 | /returns | Return | 공통(데이터 스코핑) |
| 재고현황 | /inventory | InventoryItem | 공통(데이터 스코핑) |
| SKU | /sku | Sku | 공통(데이터 스코핑) |
| NEW | /requests | WmsRequest | 공통(제출은 클라이언트, 운영자는 전체 조회) |
| WMS | /wms | WmsLink | 운영자 전용 |
| 클라이언트 | /clients | Client | 운영자 전용 |
| 사용자 | /users | User | 운영자 전용 |
| 업체관리 | /vendors | Vendor | 운영자 전용 |

- 메뉴 표시명은 위 한국어(및 SKU/NEW/WMS)를 그대로 사용 — 라우트명은 코드 내부용
- 로그인 후 기본 진입: `/inbound` (입고현황)
- 클라이언트 소유 모델(Outbound, Return, InventoryItem, Sku, WmsRequest)에는
  `client_id` 귀속 필드 필수. 물류 모델에는 국가·WMS LINK 필드 포함
  (실제 필드명은 Swagger 확인 후 통일 — 그 전까지 잠정 표기)
- **Inbound는 Swagger 확정**: 응답 스키마를 그대로 쓴다(`idx`/`ganNo`/`clntName`/`cntyCd`/
  `wmsLinkId(int)`/날짜는 UTC epoch ms). 행에 클라이언트 ID가 없으므로(clntName뿐)
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

- 인증 방식: JWT 확정(사용자, 2026-08-04) — 단 로그인 API 경로·Req/Res 형태, 토큰 전달
  방식(응답 바디 vs Set-Cookie), 리프레시 토큰 유무·만료 정책은 확인 필요. 브라우저에는
  BFF가 httpOnly 쿠키로만 심는다(원칙 5 유지 — JS 접근 토큰 금지)
- Java API 응답 래핑 형태(`{ code, data, message }` 여부), Swagger 문서
- NEW 제출 시 이메일 발송 주체(Java API vs Next.js Route Handler)
- 다국어(i18n) 적용 여부, Nginx/HTTPS 구성
- 클라이언트 로그인 계정 ↔ 마켓 관계 — 1:1로 잠정 가정 중, 한 계정의 복수 마켓 소유 가능 여부
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
    검색결과 전체 엑셀 `/dtin/dn` · 행 상세 엑셀 `/dtin/dn/{idx}` — 정의는
    `lib/api/inbound.ts`(INBOUND_API)가 단일 출처. 엑셀은 서버 생성 파일 엔드포인트라
    Phase 1의 클라이언트 CSV 생성은 Phase 2에 서버 다운로드로 교체한다.
    전역 래핑(`{ code, data, message }`) 여부는 여전히 미확인
  - 카운트 API 문서의 status enum에 보이는 `WORK`는 **실재하지 않는 값(사용자 확인)** —
    상태는 PLAN/STANDBY/COMPLETED/CANCELED(+응답 전용 UNKNOW)가 전부이며 WORK는 무시한다

## 개발 단계

- **Phase 1 (종료)**: 타입·목데이터 → 공통 컴포넌트 → 입고현황·로그인 조립까지 완료
- **Phase 2 (현재 — 사용자 확정 2026-08-04로 조기 착수)**: JWT 인증 + 확정 도메인(입고)부터
  BFF(Route Handler) 연동 → 실데이터 검증 후, 나머지 메뉴는 실 API 기반으로 조립한다
  (화면 전부 목으로 먼저 만드는 원계획을 사용자 지시로 변경). Docker/CI/배포는 후순위.
  연동 착수 전 선행 확인 필수: 인증 API 스펙 · 응답 전역 래핑 여부 · dev에서 접근 가능한
  API_BASE_URL(주의: `next dev`는 `.env.production`을 읽지 않는다 — `.env.local` 필요)

## 명령어

```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드 (standalone)
npm run lint     # 린트
```