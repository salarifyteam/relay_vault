import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      // OpenAI 호환: 외부에서 보는 /v1/* 를 내부 /api/v1/* 로 매핑
      { source: "/v1/:path*", destination: "/api/v1/:path*" },
    ];
  },
};

export default nextConfig;
