/**
 * layout.tsx - 애플리케이션 루트 레이아웃
 * 
 * 🎯 기능:
 * - Next.js 애플리케이션의 최상위 레이아웃 정의
 * - 전역 폰트 설정 (Geist Sans, Geist Mono)
 * - 전역 CSS 스타일 적용
 * - 프로바이더 래핑 (React Query, Zustand 등)
 * 
 * 🔗 연관 파일:
 * - globals.css: 전역 CSS 스타일
 * - providers.tsx: 애플리케이션 프로바이더들
 * 
 * ⭐ 중요도: ⭐⭐⭐ 매우 중요 - 애플리케이션 기본 구조
 * 
 * 🎨 폰트 설정:
 * - Geist Sans: 기본 텍스트용 폰트
 * - Geist Mono: 코드/데이터 표시용 모노스페이스 폰트
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

// Geist Sans 폰트 설정 (기본 텍스트용)
const geistSans = Geist({
  variable: "--font-geist-sans",  // CSS 변수명
  subsets: ["latin"],            // 라틴 문자 서브셋
});

// Geist Mono 폰트 설정 (코드/데이터 표시용)
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",  // CSS 변수명
  subsets: ["latin"],            // 라틴 문자 서브셋
});

// 애플리케이션 메타데이터 설정
export const metadata: Metadata = {
  title: "Materials Dashboard",                    // 페이지 제목
  description: "Engineering Materials Management Dashboard", // 페이지 설명
};

// 루트 레이아웃 컴포넌트
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko"> {/* 한국어 설정 */}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true} // 하이드레이션 경고 억제
      >
        {/* 전역 프로바이더로 애플리케이션 래핑 */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
