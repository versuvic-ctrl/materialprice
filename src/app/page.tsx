/**
 * page.tsx - 메인 대시보드 페이지
 * 
 * 🎯 기능:
 * - 자재 가격 대시보드 메인 화면
 * - 전체 통계 카드 (총 자재 수, 카테고리 수, 평균 가격)
 * - 동적 차트 그리드 (6개 미니 차트)
 * - 계산기 및 참고자료 미리보기
 * 
 * 🔗 연관 파일:
 * - components/DashboardClient.tsx: 통계 카드 렌더링
 * - components/dashboard/DashboardChartGrid.tsx: 차트 그리드
 * - components/dashboard/CalculatorPreview.tsx: 계산기 미리보기
 * - components/dashboard/ReferenceSection.tsx: 참고자료 섹션
 * 
 * ⭐ 중요도: ⭐⭐⭐ 필수 - 애플리케이션 메인 페이지
 * 
 * 📊 데이터 소스: 샘플 데이터 (향후 Supabase 연동 예정)
 */
import ReferenceSection from '@/components/dashboard/ReferenceSection';
import CalculatorPreview from '@/components/dashboard/CalculatorPreview';
import DashboardClient from '@/components/dashboard/DashboardClient';
import CronInitializer from '@/components/CronInitializer';
import { createClient } from '@/utils/supabase/server';
import { redis } from '@/utils/redis';
import dynamicImport from 'next/dynamic';

// 빌드 시 프리렌더 오류를 회피하기 위해 동적 렌더링 강제
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 무거운 차트 컴포넌트들을 동적 import로 최적화
const DashboardChartGrid = dynamicImport(() => import('@/components/dashboard/DashboardChartGrid'), {
  loading: () => (
    <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
      <div className="text-gray-500">차트 로딩 중...</div>
    </div>
  )
});

const MarketIndicatorsSummary = dynamicImport(() => import('@/components/dashboard/MarketIndicatorsSummary'), {
  loading: () => (
    <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
      <div className="text-gray-500">시장 지표 로딩 중...</div>
    </div>
  )
});

// 서버 컴포넌트에서 대시보드 데이터를 가져오는 함수
async function getDashboardData() {
  const cacheKey = 'dashboard_summary_data';
  const cacheExpiry = 3600; // 1시간 (초 단위)

  // 1. Redis 캐시 확인
  try {
    const cachedData = await redis.get(cacheKey);
    if (typeof cachedData === 'string') {
      console.log('Dashboard data fetched from Redis cache.');
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.error('Redis cache read error:', error);
  }

  // 2. Supabase에서 데이터 가져오기
  const supabase = await createClient();

  let totalMaterials = 0;
  let totalCategories = 0;
  let averagePrice = 0;

  // 총 자재 수 (고유한 specification 수)
  const { count: materialsCount, error: materialsError } = await supabase
    .from('kpi_price_data')
    .select('specification', { count: 'exact' });

  if (materialsError) {
    console.error('Error fetching total materials:', materialsError);
  } else {
    totalMaterials = materialsCount || 0;
  }

  // 총 카테고리 수 (고유한 sub_category 수)
  const { count: categoriesCount, error: categoriesError } = await supabase
    .from('kpi_price_data')
    .select('sub_category', { count: 'exact', head: true });


  if (categoriesError) {
    console.error('Error fetching total categories:', categoriesError);
  } else {
    totalCategories = categoriesCount || 0;
  }

  // 평균 가격
  const { data: avgPriceResult, error: avgPriceError } = await supabase
    .from('average_daily_prices')
    .select('average_price');

  if (avgPriceError) {
    console.error('Error fetching average price:', JSON.stringify(avgPriceError, null, 2));
  } else {
    averagePrice = avgPriceResult && avgPriceResult[0] && typeof avgPriceResult[0].average_price === 'number'
      ? Math.round(avgPriceResult[0].average_price)
      : 0;
  }

  const dashboardData = {
    total_materials: totalMaterials,
    total_categories: totalCategories,
    average_price: averagePrice,
    recent_updates: 12 // 현재는 샘플 값 유지
  };

  // 3. Redis에 데이터 저장
  try {
    await redis.setex(cacheKey, cacheExpiry, JSON.stringify(dashboardData));
    console.log('Dashboard data saved to Redis cache.');
  } catch (error) {
    console.error('Redis cache write error:', error);
  }

  return dashboardData;
}

export default async function Dashboard() {
  // 대시보드 통계 데이터 가져오기
  const dashboardData = await getDashboardData();
  
  return (
    <>
      {/* Cron Job 초기화 (UI 없음) */}
      <CronInitializer />


      
      {/* 통계 카드 섹션 */}
      <DashboardClient dashboardData={dashboardData} />
      
      {/* 중앙 차트 그리드 섹션 */}
      <div className="mt-4">
        <DashboardChartGrid />
      </div>

      {/* 하단 요약 섹션 */}
      {/* 계산기 미리보기와 참고자료를 2열로 배치 */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CalculatorPreview title="엔지니어링 계산기 요약" />
        <ReferenceSection title="참고 자료 요약" />
      </div>
    </>
  );
}