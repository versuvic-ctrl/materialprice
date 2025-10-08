'use client';

import { useEffect } from 'react';

export default function CronInitializer() {
  useEffect(() => {
    // 컴포넌트 마운트 시 cron job 초기화
    const initializeCronJobs = async () => {
      try {
        // 개발 환경에서만 실행
        if (process.env.NODE_ENV === 'development') {
          console.log('Cron job 초기화 시작...');
          
          const response = await fetch('/api/market-indicators/cron', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'start' }),
          });

          if (response.ok) {
            const data = await response.json();
            console.log('Cron job 초기화 성공:', data.message);
          } else {
            console.error('Cron job 초기화 실패:', response.status, response.statusText);
          }
        }
      } catch (error) {
        console.error('Cron job 초기화 중 오류:', error);
      }
    };

    // 페이지 로드 후 잠시 대기 후 초기화 (서버가 완전히 준비된 후)
    const timer = setTimeout(() => {
      initializeCronJobs();
    }, 2000);

    // 컴포넌트 언마운트 시 정리
    return () => {
      clearTimeout(timer);
      
      // 개발 환경에서 페이지 언로드 시 cron job 정리
      const cleanup = async () => {
        try {
          if (process.env.NODE_ENV === 'development') {
            await fetch('/api/market-indicators/cron', {
              method: 'DELETE',
            });
          }
        } catch (error) {
          console.error('Cron job 정리 중 오류:', error);
        }
      };

      // beforeunload 이벤트 리스너 추가
      const handleBeforeUnload = () => {
        cleanup();
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      
      // cleanup 함수에서 이벤트 리스너 제거
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // 이 컴포넌트는 UI를 렌더링하지 않음
  return null;
}