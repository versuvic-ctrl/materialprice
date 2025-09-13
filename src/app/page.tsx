import Layout from '@/components/layout/Layout';
import DashboardCharts from '@/components/dashboard/DashboardCharts';
import ReferenceSection from '@/components/dashboard/ReferenceSection';
import CalculatorPreview from '@/components/dashboard/CalculatorPreview';
import DashboardClient from '@/components/DashboardClient';





// 샘플 대시보드 데이터
function getDashboardData() {
  return {
    total_materials: 150,
    total_categories: 25,
    average_price: 6500,
    recent_updates: 12
  };
}

export default function Dashboard() {
  // 샘플 데이터 사용
  const dashboardData = getDashboardData();
  
  return (
    <Layout title="대시보드">
      {/* 클라이언트 컴포넌트로 데이터 전달 */}
      <DashboardClient dashboardData={dashboardData} />
      
      {/* 차트 섹션 */}
      <div className="mt-8">
        <DashboardCharts />
      </div>
      
      {/* 요약 섹션: 계산기 / 참고자료 */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CalculatorPreview title="엔지니어링 계산기 요약" />
        <ReferenceSection title="참고 자료 요약" />
      </div>
    </Layout>
  );
}
