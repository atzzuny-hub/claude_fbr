import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 배포 전제 (CLAUDE.md 기술 스택) — standalone 출력 유지
  output: "standalone",
};

export default nextConfig;
