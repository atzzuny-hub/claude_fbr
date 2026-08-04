import { COUNTRY, COUNTRY_LABEL, type Country } from "@/types";

/**
 * 로그인 좌측 브랜드 패널 — 심야 인디고(brand-950) 위에 워드마크·헤드라인과
 * 시그니처 "네트워크 레일"(REVE 허브 → PH/MY/VN 노선도) 다이어그램을 배치한다.
 * 국가 노드는 types의 COUNTRY/COUNTRY_LABEL 단일 출처에서 파생 — 국가가 늘면 여기도 는다.
 * 시각 요소는 전부 장식(aria-hidden)이고, 스크린리더에는 워드마크와 카피만 전달된다.
 * lg 미만에서는 렌더링하지 않는다(page.tsx의 모바일 워드마크 밴드가 대체).
 */

/**
 * 노선도 viewBox(0 0 420 210) 좌표 — 허브 분기점(x=78,y=105)에서 각 국가 노드로.
 * begin은 음수(과거 시작) — 양수 지연을 주면 시작 전 펄스 원이 기저 위치인 SVG 원점(0,0)에
 * 그대로 보이는 유령 점이 생긴다(실측 확인). 음수면 로드 시점에 이미 경로 위 중간 지점에 있다.
 */
const RAIL_GEOMETRY: Record<Country, { y: number; dur: string; begin: string }> = {
  PH: { y: 41, dur: "5.2s", begin: "0s" },
  MY: { y: 105, dur: "3.8s", begin: "-1.4s" },
  VN: { y: 169, dur: "5.6s", begin: "-2.6s" },
};

/** 허브(y=105)에서 y까지 — 수평 진행 후 라운드 엘보 2번으로 노드 높이에 도킹하는 노선 */
function railPath(y: number): string {
  if (y === 105) return "M78 105 H318";
  const up = y < 105;
  const elbow1 = up ? "Q166 105 166 89" : "Q166 105 166 121";
  return `M78 105 H150 ${elbow1} V${up ? y + 16 : y - 16} Q166 ${y} 182 ${y} H318`;
}

function RouteRails() {
  return (
    <svg
      viewBox="0 0 420 210"
      aria-hidden="true"
      className="w-full max-w-md"
      fill="none"
    >
      {/* 허브 칩 — 출발점 REVE */}
      <rect x="1" y="85" width="76" height="40" rx="12" className="fill-white/5 stroke-brand-300/30" />
      <circle cx="17" cy="105" r="3" className="fill-brand-300" />
      <text x="29" y="105" dominantBaseline="central" className="fill-white font-mono text-[12px] font-bold tracking-wider">
        REVE
      </text>

      {COUNTRY.map((code) => {
        const { y, dur, begin } = RAIL_GEOMETRY[code];
        const path = railPath(y);
        return (
          <g key={code}>
            <path d={path} className="stroke-brand-300/30" strokeWidth="1.5" strokeLinecap="round" />
            {/* 국가 노드(링 + 점)와 라벨 */}
            <circle cx="318" cy={y} r="7" className="stroke-brand-300/40" />
            <circle cx="318" cy={y} r="3" className="fill-brand-300" />
            <text x="334" y={y - 1} className="fill-white font-mono text-[13px] font-bold tracking-wider">
              {code}
            </text>
            <text x="334" y={y + 13} className="fill-brand-200/80 text-[11px]">
              {COUNTRY_LABEL[code]}
            </text>
            {/* 노선 위를 흐르는 화물 펄스 — 모션 최소화 설정에서는 숨긴다 */}
            <circle r="6" className="fill-brand-300/25 motion-reduce:hidden">
              <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={path} />
            </circle>
            <circle r="2.5" className="fill-brand-300 motion-reduce:hidden">
              <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={path} />
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

export function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-brand-950 text-white lg:flex lg:w-[46%] lg:max-w-2xl lg:flex-col lg:justify-between lg:gap-16 lg:p-12">
      {/* 도트 그리드(노선 차트 질감) + 라벤더 글로우 — 좌상단에서 은은하게 사라진다 */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle,rgba(146,143,238,0.14)_1px,transparent_1px)] bg-size-[26px_26px] mask-[radial-gradient(ellipse_at_top_left,black_25%,transparent_72%)]"
      />
      <div aria-hidden="true" className="absolute top-1/3 -left-32 size-96 rounded-full bg-brand-400/20 blur-3xl" />

      <div className="relative flex items-center gap-2">
        <span aria-hidden="true" className="flex items-center text-xl font-extrabold tracking-tight">
          Reve
          <span className="mx-px mt-[0.14em] size-[0.56em] rounded-full bg-brand-300" />
          n
        </span>
        <span className="sr-only">Reveon</span>
        <span className="rounded-md bg-white/10 px-1.5 py-1 font-mono text-[10px] leading-none font-bold tracking-wider text-brand-200">
          FBR V-1
        </span>
      </div>

      <div className="relative flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <p className="text-[2.5rem] leading-[1.16] font-bold tracking-tight text-balance">
            동남아 풀필먼트,
            <br />한 화면에서.
          </p>
          <p className="max-w-md text-[0.95rem] leading-relaxed break-keep text-brand-200">
            동남아 창고의 입고부터 출고 · 반품 · 재고까지, REVE FBR
            하나로 추적합니다.
          </p>
        </div>
        <RouteRails />
      </div>

      <p className="relative font-mono text-[11px] tracking-wider text-brand-200/60">
        승인된 계정 전용 · © 2026 REVE
      </p>
    </aside>
  );
}
