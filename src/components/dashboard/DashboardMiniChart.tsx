// src/components/dashboard/DashboardMiniChart.tsx

'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import useMaterialStore from '@/store/materialStore'; // 기존 스토어 재사용

// Supabase 클라이언트 (별도 파일로 분리하는 것을 권장)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 데이터 페칭 함수 (MaterialsChart.tsx와 동일)
const fetchPriceData = async (
  materials: string[],
  startDate: string,
  endDate: string,
  interval: 'weekly' | 'monthly' | 'yearly'
) => {
  if (!materials || materials.length === 0) return [];
  const { data, error } = await supabase.rpc('get_price_data', {
    p_specifications: materials,
    p_start_date: startDate,
    p_end_date: endDate,
    p_interval: interval,
    p_major_categories: null, p_middle_categories: null, p_sub_categories: null,
  });
  if (error) throw new Error(error.message);
  return data;
};

// 데이터 변환 함수 (MaterialsChart.tsx와 동일)
const transformDataForChart = (data: any[]) => {
  if (!data || data.length === 0) return [];
  const groupedData = data.reduce((acc, item) => {
    const { time_bucket, specification, average_price } = item;
    if (!acc[time_bucket]) acc[time_bucket] = { time_bucket };
    acc[time_bucket][specification] = parseFloat(average_price);
    return acc;
  }, {});
  return Object.values(groupedData);
};

// 각 라인에 대한 색상 팔레트
const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

interface DashboardMiniChartProps {
  title: string;
  materials: string[];
}

const DashboardMiniChart: React.FC<DashboardMiniChartProps> = ({ title, materials }) => {
  // Zustand 스토어에서 공통 상태(기간, 날짜)를 가져옴
  const { interval, startDate, endDate } = useMaterialStore();

  const { data: rawData, isLoading, isError, error } = useQuery({
    // queryKey에 title, materials를 추가하여 각 차트의 쿼리를 고유하게 만듦
    queryKey: ['dashboardChart', title, materials, startDate, endDate, interval],
    queryFn: () => fetchPriceData(materials, startDate, endDate, interval),
    staleTime: 1000 * 60 * 5, // 5분 캐시
  });

  const chartData = useMemo(() => transformDataForChart(rawData || []), [rawData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-md font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : isError ? (
            <div className="flex h-full items-center justify-center text-red-500">
              오류: {error.message}
            </div>
          ) : !chartData || chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-500">
              데이터 없음
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                <XAxis dataKey="time_bucket" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`} />
                <Tooltip wrapperClassName="text-xs" />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
                {materials.map((material, index) => (
                  <Line
                    key={material}
                    type="monotone"
                    dataKey={material}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardMiniChart;