import Layout from '@/components/layout/Layout';
import DashboardCharts from '@/components/DashboardCharts';
import ReferenceSection from '@/components/dashboard/ReferenceSection';
import CalculatorPreview from '@/components/dashboard/CalculatorPreview';
import DashboardClient from '@/components/DashboardClient';





// 서버 컴포넌트에서 실제 데이터 가져오기
async function getDashboardData() {
  try {
    const res = await fetch('http://localhost:8000/materials/dashboard-summary', {
      cache: 'no-store',
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Dashboard data fetch error:', error);
    return null;
  }
}

export default async function Dashboard() {
  // 서버에서 실제 데이터 가져오기
  const dashboardData = await getDashboardData();
  
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
