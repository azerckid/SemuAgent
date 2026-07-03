import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://company.jaaryo.online"),
  title: {
    default: "SemuAgent — 작은 회사를 위한 AI 세무 에이전트",
    template: "%s · SemuAgent",
  },
  description:
    "작은 회사가 AI로 증빙 수집, 기장검토, 부가세, 급여정산, 신고자료 생성을 자동화하도록 돕는 세무 업무 에이전트.",
  applicationName: "SemuAgent",
  alternates: { canonical: "/" },
  keywords: [
    "JARYO",
    "SemuAgent",
    "jaryo",
    "자료",
    "회사 회계",
    "자가 기장",
    "부가세 계산",
    "급여정산",
    "홈택스 신고 보조",
    "신고자료 생성",
  ],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://company.jaaryo.online",
    siteName: "SemuAgent",
    title: "SemuAgent — 작은 회사를 위한 AI 세무 에이전트",
    description:
      "증빙 수집부터 기장검토, 부가세, 급여정산, 홈택스 제출 보조 자료까지 AI로 정리합니다.",
  },
  twitter: {
    card: "summary",
    title: "SemuAgent — 작은 회사를 위한 AI 세무 에이전트",
    description:
      "작은 회사가 직접 세무신고를 준비할 수 있도록 AI가 신고자료 패키지를 정리합니다.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
