/**
 * DashboardClient.tsx - 대시보드 메인 통계 카드 컴포넌트
 * 
 * 기능:
 * - 총 자재 수, 카테고리 수, 평균 가격 등 핵심 통계 표시
 * - 로딩 상태 시 스켈레톤 UI 제공
 * - 반응형 그리드 레이아웃으로 카드 배치
 * 
 * 연관 파일:
 * - src/app/page.tsx (메인 대시보드 페이지에서 사용)
 * - src/components/ui/card.tsx (카드 UI 컴포넌트)
 * - src/components/ui/skeleton.tsx (로딩 스켈레톤)
 * 
 * 중요도: ⭐⭐⭐ 필수 - 대시보드의 핵심 통계 표시
 * 
 * 데이터 소스: 서버 컴포넌트에서 props로 전달받음
 */
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

// 대시보드 통계 데이터 타입 정의
interface DashboardData {
  total_materials: number;    // 총 자재 수
  total_categories: number;   // 총 카테고리 수
  average_price: number;      // 평균 가격
}

// 컴포넌트 props 타입 정의
interface DashboardClientProps {
  dashboardData: DashboardData | null;  // null일 경우 로딩 상태 표시
}

const DashboardClient: React.FC<DashboardClientProps> = ({ dashboardData }) => {
  // 데이터가 없을 때 스켈레톤 로딩 UI 표시
  if (!dashboardData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[...Array(3)].map((_, index) => (
          <Card key={index} className="border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium text-gray-800">
                <Skeleton className="h-4 w-20" />
              </CardTitle>
              <Skeleton className="h-6 w-6 rounded" />
            </CardHeader>
            <CardContent className="pt-1">
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // 가격을 한국 원화 형식으로 포맷팅
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
    }).format(price);
  };

  // 변화율을 퍼센트 형식으로 포맷팅 (현재 미사용)
  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {/* 총 자재 수 */}
      <Card className="border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm font-medium text-gray-800">총 자재 수</CardTitle>
          <div className="text-blue-600">📦</div>
        </CardHeader>
        <CardContent className="pt-1">
          <div className="text-xl font-bold text-blue-700">
            {dashboardData.total_materials.toLocaleString()}개
          </div>
          <p className="text-xs text-gray-600">
            등록된 전체 자재
          </p>
        </CardContent>
      </Card>

      {/* 총 카테고리 수 */}
      <Card className="border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm font-medium text-gray-800">총 카테고리 수</CardTitle>
          <div className="text-purple-600">📂</div>
        </CardHeader>
        <CardContent className="pt-1">
          <div className="text-xl font-bold text-purple-700">
            {dashboardData.total_categories.toLocaleString()}개
          </div>
          <p className="text-xs text-gray-600">
            자재 분류 체계
          </p>
        </CardContent>
      </Card>

      {/* 평균 가격 */}
      <Card className="border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm font-medium text-gray-800">평균 가격</CardTitle>
          <div className="text-blue-600">
            💰
          </div>
        </CardHeader>
        <CardContent className="pt-1">
          <div className="text-xl font-bold text-blue-700">
            {formatPrice(dashboardData.average_price)}
          </div>
          <p className="text-xs text-gray-600">
            원/단위
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardClient;