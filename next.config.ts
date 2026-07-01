import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy.
 *
 * nonce 기반 strict-dynamic CSP는 요청마다 nonce가 바뀌어 모든 페이지를 동적
 * 렌더링으로 강제하고, 정적 페이지(로그인/온보딩/소개)의 스크립트가 nonce를 갖지
 * 못해 깨진다. 그래서 깨지지 않는 정적 CSP를 사용한다.
 *
 * 허용 외부 출처
 * - js.tosspayments.com  : Toss 결제 SDK 스크립트
 * - *.tosspayments.com   : 결제창 iframe·API 호출
 * - vercel.com           : @vercel/blob/client upload()가 브라우저에서 직접 PUT하는
 *                          Blob API 엔드포인트(https://vercel.com/api/blob). 이게 없으면
 *                          업로드 포털·고객 문서 업로드가 connect-src에 차단된다.
 * - *.vercel-storage.com : Blob 멀티파트/직접 업로드·공개 URL 미리보기
 *
 * Trusted Types는 이메일 본문 미리보기(dangerouslySetInnerHTML)를 깨뜨리므로 강제하지 않는다.
 */
const csp = [
  "default-src 'self'",
  // Next.js 하이드레이션 인라인 스크립트 때문에 'unsafe-inline' 필요. (dev는 HMR용 eval 추가)
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.tosspayments.com`,
  // Tailwind/shadcn 인라인 스타일
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.vercel-storage.com https://*.tosspayments.com",
  "font-src 'self'",
  `connect-src 'self' https://vercel.com https://*.vercel-storage.com https://*.tosspayments.com${isDev ? " ws:" : ""}`,
  "frame-src https://*.tosspayments.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // HTTPS 강제 (1년, 서브도메인 포함, preload 대상)
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  // 클릭재킹 방지 (CSP frame-ancestors와 이중 방어)
  { key: "X-Frame-Options", value: "DENY" },
  // MIME 스니핑 방지
  { key: "X-Content-Type-Options", value: "nosniff" },
  // origin isolation (COOP) — OAuth 팝업을 쓰지 않으므로 same-origin 안전
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // 레퍼러 최소 노출
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 사용하지 않는 강력 권한 차단
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/sessions/*/payroll/drafts': [
      './public/payroll/templates/업로드용_엑셀파일.xlsx',
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
