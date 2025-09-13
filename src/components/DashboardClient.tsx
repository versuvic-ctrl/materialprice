'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

interface DashboardData {
  total_materials: number;
  total_categories: number;
  average_price: number;
}

interface DashboardClientProps {
  dashboardData: DashboardData | null;
}

const DashboardClient: React.FC<DashboardClientProps> = ({ dashboardData }) => {
  if (!dashboardData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {[...Array(3)].map((_, index) => (
          <Card key={index} className="border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-800">
                <Skeleton className="h-4 w-20" />
              </CardTitle>
              <Skeleton className="h-6 w-6 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {/* 총 자재 수 */}
      <Card className="border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-800">총 자재 수</CardTitle>
          <div className="text-blue-600">📦</div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-700">
            {dashboardData.total_materials.toLocaleString()}개
          </div>
          <p className="text-xs text-gray-600 mt-1">
            등록된 전체 자재
          </p>
        </CardContent>
      </Card>

      {/* 총 카테고리 수 */}
      <Card className="border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-800">총 카테고리 수</CardTitle>
          <div className="text-purple-600">📂</div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-700">
            {dashboardData.total_categories.toLocaleString()}개
          </div>
          <p className="text-xs text-gray-600 mt-1">
            자재 분류 체계
          </p>
        </CardContent>
      </Card>

      {/* 평균 가격 */}
      <Card className="border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-800">평균 가격</CardTitle>
          <div className="text-blue-600">
            💰
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-700">
            {formatPrice(dashboardData.average_price)}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            원/단위
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardClient;