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
import Layout from '@/components/layout/Layout';
// [제거] import DashboardCharts from '@/components/dashboard/DashboardCharts';
import ReferenceSection from '@/components/dashboard/ReferenceSection';
import CalculatorPreview from '@/components/dashboard/CalculatorPreview';
import DashboardClient from '@/components/DashboardClient';
import DashboardChartGrid from '@/components/dashboard/DashboardChartGrid'; // [추가] 새로 만든 차트 그리드 컴포넌트를 import 합니다.

// 빌드 시 프리렌더 오류를 회피하기 위해 동적 렌더링 강제
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 서버 컴포넌트에서 대시보드 데이터를 가져오는 함수
// 현재는 샘플 데이터를 반환하지만, 향후 Supabase에서 실제 데이터를 가져올 예정
function getDashboardData() {
  return {
    total_materials: 150,    // 총 자재 수
    total_categories: 25,    // 총 카테고리 수
    average_price: 6500,     // 평균 가격 (원)
    recent_updates: 12       // 최근 업데이트 수
  };
}

export default function Dashboard() {
  // 대시보드 통계 데이터 가져오기
  const dashboardData = getDashboardData();
  
  return (
    <Layout title="대시보드">
      
      {/* 통계 카드 섹션 */}
      <DashboardClient dashboardData={dashboardData} />
      
      {/* 중앙 차트 그리드 섹션 */}
      {/* 6개의 동적 미니 차트와 공통 필터를 포함 */}
      <div className="mt-8">
        <DashboardChartGrid />
      </div>
      
      {/* 하단 요약 섹션 */}
      {/* 계산기 미리보기와 참고자료를 2열로 배치 */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CalculatorPreview title="엔지니어링 계산기 요약" />
        <ReferenceSection title="참고 자료 요약" />
      </div>
    </Layout>
  );
}