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
  const cacheExpiry = 432000; // 5일 (초 단위) - 크롤링 주기와 동일

  // 1. Redis 캐시 확인
  try {
    const cachedData = await redis.get(cacheKey);
    if (typeof cachedData === 'string') {
      console.log('✅ Redis에서 대시보드 데이터 로드');
      return JSON.parse(cachedData);
    }
  } catch (error) {
    console.error('Redis cache read error:', error);
  }

  console.log('🔄 Supabase에서 대시보드 데이터 가져오는 중...');

  // 2. Supabase에서 데이터 가져오기
  const supabase = await createClient();

  let totalMaterials = 0;
  let totalCategories = 0;
  let totalRegions = 0;
  let averagePrice = 0;

  // 집계 테이블에서 통계 데이터 조회 (우선순위)
  const { data: statsData, error: statsError } = await supabase
    .from('material_statistics')
    .select('stat_type, stat_value')
    .in('stat_type', ['total_materials', 'total_categories', 'total_regions']);

  if (!statsError && statsData && statsData.length > 0) {
    // 집계 테이블에서 데이터 가져오기 성공
    console.log('✅ 집계 테이블에서 통계 데이터 로드');
    statsData.forEach(stat => {
      switch (stat.stat_type) {
        case 'total_materials':
          totalMaterials = stat.stat_value;
          break;
        case 'total_categories':
          totalCategories = stat.stat_value;
          break;
        case 'total_regions':
          totalRegions = stat.stat_value;
          break;
      }
    });
  } else {
    // 집계 테이블이 없거나 오류 시 기존 방식으로 폴백
    console.log('⚠️ 집계 테이블 조회 실패, 기존 방식으로 폴백');
    
    // 개별 캐시 키 정의
    const materialsCacheKey = 'total_materials_count';
    const categoriesCacheKey = 'total_categories_count';
    const regionsCacheKey = 'total_regions_count';
    
    // 병렬로 캐시 확인 및 데이터 조회
    const [materialsResult, categoriesResult, regionsResult] = await Promise.allSettled([
      // 총 자재 수 처리
      (async () => {
        try {
          const cachedMaterials = await redis.get(materialsCacheKey);
          if (typeof cachedMaterials === 'string') {
            console.log('✅ Redis에서 total materials 로드:', cachedMaterials);
            return parseInt(cachedMaterials, 10);
          }
          
          const { data: materialsData, error: materialsError } = await supabase
            .from('kpi_price_data')
            .select('specification')
            .limit(10000);

          if (materialsError) throw materialsError;
          
          const uniqueSpecs = new Set(materialsData?.map(item => item.specification) || []);
          const count = uniqueSpecs.size;
          
          await redis.setex(materialsCacheKey, cacheExpiry, count.toString());
          console.log('✅ total materials 계산 완료 및 캐시 저장:', count);
          return count;
        } catch (error) {
          console.error('Error handling total materials:', error);
          return 0;
        }
      })(),
      
      // 총 카테고리 수 처리
      (async () => {
        try {
          const cachedCategories = await redis.get(categoriesCacheKey);
          if (typeof cachedCategories === 'string') {
            console.log('✅ Redis에서 total categories 로드:', cachedCategories);
            return parseInt(cachedCategories, 10);
          }
          
          const { data: categoriesData, error: categoriesError } = await supabase
            .from('kpi_price_data')
            .select('sub_category')
            .limit(10000);

          if (categoriesError) throw categoriesError;
          
          const uniqueCategories = new Set(categoriesData?.map(item => item.sub_category) || []);
          const count = uniqueCategories.size;
          
          await redis.setex(categoriesCacheKey, cacheExpiry, count.toString());
          console.log('✅ total categories 계산 완료 및 캐시 저장:', count);
          return count;
        } catch (error) {
          console.error('Error handling total categories:', error);
          return 0;
        }
      })(),
      
      // 총 지역 수 처리
      (async () => {
        try {
          const cachedRegions = await redis.get(regionsCacheKey);
          if (typeof cachedRegions === 'string') {
            console.log('✅ Redis에서 total regions 로드:', cachedRegions);
            return parseInt(cachedRegions, 10);
          }
          
          const { data: regionsData, error: regionsError } = await supabase
            .from('kpi_price_data')
            .select('region')
            .limit(10000);

          if (regionsError) throw regionsError;
          
          const uniqueRegions = new Set(regionsData?.map(item => item.region) || []);
          const count = uniqueRegions.size;
          
          await redis.setex(regionsCacheKey, cacheExpiry, count.toString());
          console.log('✅ total regions 계산 완료 및 캐시 저장:', count);
          return count;
        } catch (error) {
          console.error('Error handling total regions:', error);
          return 0;
        }
      })()
    ]);

    // 결과 할당
    totalMaterials = materialsResult.status === 'fulfilled' ? materialsResult.value : 0;
    totalCategories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : 0;
    totalRegions = regionsResult.status === 'fulfilled' ? regionsResult.value : 0;
  }

  // 평균 가격 (LIMIT 적용으로 타임아웃 방지)
  const { data: avgPriceResult, error: avgPriceError } = await supabase
    .from('average_daily_prices')
    .select('average_price')
    .limit(1);

  if (avgPriceError) {
    console.error('Error fetching average price:', JSON.stringify(avgPriceError, null, 2));
  } else {
    averagePrice = avgPriceResult && avgPriceResult[0] && typeof avgPriceResult[0].average_price === 'number'
      ? Math.round(avgPriceResult[0].average_price)
      : 0;
  }

  // 최신 업데이트 데이터 - 타임아웃 문제로 인해 임시 비활성화
  // TODO: 인덱스 적용 후 다시 활성화 예정
  const latestData: any[] = [];
  console.log('⚠️ Latest updates 쿼리 임시 비활성화 (타임아웃 방지)');

  const dashboardData = {
    totalMaterials,
    totalCategories,
    totalRegions,
    averagePrice,
    latestUpdates: latestData,
    recent_updates: 12 // 현재는 샘플 값 유지
  };

  // 3. Redis에 데이터 저장
  try {
    await redis.setex(cacheKey, cacheExpiry, JSON.stringify(dashboardData));
    console.log('✅ 대시보드 데이터 캐시 저장 완료');
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
        <ReferenceSection title="기술 자료 요약" />
      </div>
    </>
  );
}