import localFont from "next/font/local";

/**
 * Pretendard — 리브온 솔루션 디자인 템플릿 지정 서체.
 *
 * CDN(외부 요청)은 CSP·오프라인/standalone 배포 전제와 충돌하므로 쓰지 않는다. 대신 `pretendard`
 * npm 패키지(devDependency 아닌 dependency로 설치되어 Docker 빌드에도 포함됨)에 들어있는 정적
 * woff2 파일을 next/font/local로 읽어 빌드 시점에 자체 호스팅한다 — 브라우저는 이 앱의 도메인에서만
 * 폰트를 받고, 런타임에 pretendard.kr 등 외부로 나가는 요청은 전혀 없다.
 *
 * 두께는 실제 사용 중인 4단계(400/500/600/700)만 선언해 다운로드 용량을 최소화한다.
 * variable 이름(--font-sans)은 globals.css의 @theme 토큰과 그대로 맞춘다.
 */
export const fontSans = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    {
      path: "../../node_modules/pretendard/dist/web/static/woff2/Pretendard-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/pretendard/dist/web/static/woff2/Pretendard-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../node_modules/pretendard/dist/web/static/woff2/Pretendard-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../node_modules/pretendard/dist/web/static/woff2/Pretendard-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  fallback: [
    "-apple-system",
    "BlinkMacSystemFont",
    "system-ui",
    "Apple SD Gothic Neo",
    "Malgun Gothic",
    "sans-serif",
  ],
});
