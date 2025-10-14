/**
 * providers.tsx - 애플리케이션 전역 프로바이더
 * 
 * 🎯 기능:
 * - React Query 클라이언트 설정 및 제공
 * - 전역 상태 관리 프로바이더 래핑
 * - 개발 도구 설정 (React Query Devtools)
 * 
 * 🔗 연관 파일:
 * - layout.tsx: 이 프로바이더를 사용하는 루트 레이아웃
 * - 모든 페이지 컴포넌트: React Query 훅 사용
 * 
 * ⭐ 중요도: ⭐⭐⭐ 매우 중요 - 전역 상태 관리 기반
 * 
 * 🔧 설정:
 * - React Query: 서버 상태 관리
 * - 캐시 정책: 실시간 데이터 우선
 * - 자동 재요청: 포커스/재연결/마운트 시
 */
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

// 전역 프로바이더 컴포넌트
export default function Providers({ children }: { children: React.ReactNode }) {
  // React Query 클라이언트 인스턴스 생성 (컴포넌트 생명주기 동안 유지)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // React Query 기본 옵션 설정
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,   // 5분 동안 캐시 유지
            gcTime: 1000 * 60 * 30,     // 30분 후 메모리에서 제거
            refetchOnWindowFocus: false, // 창 포커스 시 자동 재요청 비활성화
            refetchOnReconnect: true,   // 네트워크 재연결 시 자동 재요청
            refetchOnMount: true,       // 컴포넌트 마운트 시 자동 재요청
            retry: 1,                   // 실패 시 최대 1번 재시도
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* React Query 개발 도구 - 쿼리 상태 시각화 */}
      <ReactQueryDevtools 
        initialIsOpen={false}  // 기본적으로 닫힌 상태로 시작
      /> 
    </QueryClientProvider>
  );
}