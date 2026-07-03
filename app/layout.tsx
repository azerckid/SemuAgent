import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://company.jaaryo.online"),
  title: {
    default: "SemuDesk — 회사 자가 회계·세무 운영",
    template: "%s · SemuDesk",
  },
  description:
    "회사가 직접 증빙을 수집하고 기장, 부가세, 급여정산, 신고자료 생성을 운영하기 위한 세무데스크.",
  applicationName: "SemuDesk",
  alternates: { canonical: "/" },
  keywords: [
    "JARYO",
    "SemuDesk",
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
    siteName: "SemuDesk",
    title: "SemuDesk — 회사 자가 회계·세무 운영",
    description:
      "증빙 수집부터 기장, 부가세, 급여정산, 홈택스 제출 보조 자료까지 회사 내부에서 운영합니다.",
  },
  twitter: {
    card: "summary",
    title: "SemuDesk — 회사 자가 회계·세무 운영",
    description:
      "회사가 직접 회계·세무 업무를 처리할 수 있도록 신고자료 패키지를 준비합니다.",
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
