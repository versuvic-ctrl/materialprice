'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'; // 1. 개발 도구 포함 (좋은 기능!)
import { useState } from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // 2. 기본 옵션 설정 (중요!)
        defaultOptions: {
          queries: {
            staleTime: 0, // 캐시된 데이터도 즉시 '오래된 데이터'로 간주
            gcTime: 0, // 사용하지 않는 캐시는 즉시 메모리에서 제거
            refetchOnWindowFocus: true, // 창에 포커스가 돌아오면 자동 재요청
            refetchOnReconnect: true,  // 네트워크 재연결 시 자동 재요청
            refetchOnMount: true,      // 컴포넌트 마운트 시 자동 재요청
            retry: 3,                  // 실패 시 3번 재시도
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 개발 중에 쿼리 상태를 시각적으로 볼 수 있게 해주는 도구 */}
      <ReactQueryDevtools initialIsOpen={false} /> 
    </QueryClientProvider>
  );
}