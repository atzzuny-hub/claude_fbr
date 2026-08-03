import { cn } from "@/lib/utils";
import { COUNTRY_LABEL, type Country } from "@/types";

/*
 * 국기 아이콘 — 국가 코드별 인라인 SVG.
 *
 * 이모지 국기(🇻🇳 등)를 쓰지 않는 이유: Windows에는 국기 글리프가 없어 브라우저가 국가
 * 코드 문자("VN")를 그대로 그린다. 내부 운영자가 Windows를 쓰는 환경이므로 SVG로 둔다.
 * 외부 아이콘 패키지도 이 3개 국가에는 과하므로 필요한 만큼만 직접 그린다.
 *
 * FLAGS는 Record<Country, ...>이므로 COUNTRY에 국가를 추가하면 여기서 컴파일 에러가 난다
 * (국기 누락을 타입으로 막는다).
 * 16x12 남짓으로 작게 쓰는 전제라 태양 광선·별 개수 같은 세부는 생략하고 배색과 배치만 맞춘다.
 */

/** 말레이시아 국기의 가로줄 높이 — 전체 높이를 적/백 14줄로 나눈 값 */
const MY_STRIPE = 12 / 14;

const FLAGS: Record<Country, React.ReactNode> = {
  // 필리핀 — 위 청색 / 아래 적색, 게양대 쪽 흰 정삼각형(한 변 = 깃발 높이 → 꼭지점 x = 12·√3/2)에 금색 태양
  PH: (
    <>
      <rect width="16" height="6" fill="#0038A8" />
      <rect y="6" width="16" height="6" fill="#CE1126" />
      <path d="M0 0 10.39 6 0 12Z" fill="#fff" />
      <circle cx="3.1" cy="6" r="1.9" fill="#FCD116" />
    </>
  ),
  // 말레이시아 — 적/백 14줄(맨 위 적색, 맨 아래 백색), 좌상단 남색 칸톤(가로 1/2 · 세로 8줄)에
  // 금색 초승달과 별. 초승달은 노란 원 위에 칸톤과 같은 남색 원을 겹쳐 깎아낸다(호 path보다 어긋날 여지가 없다).
  MY: (
    <>
      <rect width="16" height="12" fill="#fff" />
      {[0, 1, 2, 3, 4, 5, 6].map((n) => (
        <rect key={n} y={n * 2 * MY_STRIPE} width="16" height={MY_STRIPE} fill="#CC0001" />
      ))}
      <rect width="8" height={MY_STRIPE * 8} fill="#010066" />
      <circle cx="3.1" cy="3.43" r="1.75" fill="#FFCC00" />
      <circle cx="3.75" cy="3.43" r="1.5" fill="#010066" />
      <path
        d="M5.9 1.93 6.24 2.97 7.33 2.97 6.45 3.61 6.78 4.64 5.9 4 5.02 4.64 5.36 3.61 4.47 2.97 5.56 2.97Z"
        fill="#FFCC00"
      />
    </>
  ),
  // 베트남 — 적색 바탕 중앙에 금색 오각성(중심 8,6 · 외반지름 4 · 내반지름 = 외반지름×sin18°/sin126°)
  VN: (
    <>
      <rect width="16" height="12" fill="#DA251D" />
      <path
        d="M8 2 8.9 4.76 11.8 4.76 9.45 6.47 10.35 9.24 8 7.53 5.65 9.24 6.55 6.47 4.2 4.76 7.1 4.76Z"
        fill="#FFFF00"
      />
    </>
  ),
};

interface CountryFlagProps {
  country: Country;
  className?: string;
}

/**
 * 국가 코드에 해당하는 국기만 그린다 — 이름은 함께 쓰는 쪽에서 텍스트로 붙인다
 * (국기만으로 국가를 식별하게 두지 않기 위해). 그래서 기본은 aria-hidden.
 * 국기 단독으로 쓸 일이 생기면 aria-hidden을 벗기고 role="img" + aria-label을 붙여야 한다.
 */
export function CountryFlag({ country, className }: CountryFlagProps) {
  return (
    <svg
      viewBox="0 0 16 12"
      aria-hidden="true"
      // 흰색이 많은 국기(PH/MY)가 흰 배경에서 경계를 잃지 않도록 얇은 테두리를 겹쳐 둔다
      className={cn("h-3 w-4 shrink-0 rounded-[1px] ring-1 ring-black/10", className)}
    >
      {FLAGS[country]}
    </svg>
  );
}

/** 국기 + 국가명 한 쌍 — 목록 셀에서 쓰는 기본 표기 */
export function CountryCell({ country, className }: CountryFlagProps) {
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <CountryFlag country={country} />
      {/* 국기는 그대로 두고(shrink-0), 열 폭이 좁아지면 국가명만 …으로 줄인다.
         truncate의 overflow-hidden이 flex 자식 최소너비를 0으로 만들어 줄어들 수 있다. */}
      <span className="truncate">{COUNTRY_LABEL[country]}</span>
    </span>
  );
}
