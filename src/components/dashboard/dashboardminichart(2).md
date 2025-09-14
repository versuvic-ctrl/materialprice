'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import {
  AreaChart, // [교체] LineChart -> AreaChart (그라데이션을 위해)
  Area,      // [추가] 그라데이션 영역(Area)을 위한 컴포넌트
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import useMaterialStore from '@/store/materialStore';

// --- 이 아래의 데이터 처리 로직은 기존 코드와 100% 동일합니다 ---

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 데이터 페칭 함수 (DB에는 실제 ID 값을 전달)
const fetchPriceData = async (
  materials: string[],
  startDate: string,
  endDate: string,
  interval: 'weekly' | 'monthly' | 'yearly'
) => {
  if (!materials || materials.length === 0) return [];
  const { data, error } = await supabase.rpc('get_price_data', {
    p_specifications: materials, p_start_date: startDate, p_end_date: endDate, p_interval: interval,
    p_major_categories: null, p_middle_categories: null, p_sub_categories: null,
  });
  if (error) throw new Error(error.message);
  return data;
};

// DB 데이터를 Recharts용으로 변환하는 함수
const transformDataForChart = (
  data: any[],
  materialsMap: { id: string; displayName: string }[]
) => {
  if (!data || data.length === 0) return [];
  const displayNameMap = new Map(materialsMap.map(m => [m.id, m.displayName]));
  const groupedData = data.reduce((acc, item) => {
    const { time_bucket, specification, average_price } = item;
    const displayName = displayNameMap.get(specification);
    if (!acc[time_bucket]) { acc[time_bucket] = { time_bucket }; }
    if (displayName) { acc[time_bucket][displayName] = parseFloat(average_price); }
    return acc;
  }, {});
  return Object.values(groupedData);
};

// [추가] 세련된 디자인을 위한 커스텀 툴팁
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <p className="text-sm font-bold text-foreground">{label}</p>
        {payload.map((pld: any, index: number) => (
          <div key={index} className="mt-1 flex items-center justify-between text-sm">
            <div className="flex items-center">
              <div className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pld.stroke }} />
              <p className="text-muted-foreground">{pld.dataKey}:</p>
            </div>
            <p className="ml-4 font-semibold">{`₩${pld.value.toLocaleString()}`}</p>
          </div>
        ))}
      </div>
    );
  }
  return null;
};


// --- 컴포넌트 로직은 대부분 동일하며, 렌더링(return) 부분만 수정됩니다 ---

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
interface MaterialInfo { id: string; displayName: string; }
interface DashboardMiniChartProps { title: string; materials: MaterialInfo[]; }

const DashboardMiniChart: React.FC<DashboardMiniChartProps> = ({ title, materials }) => {
  const { interval, startDate, endDate } = useMaterialStore();
  const materialIds = useMemo(() => materials.map(m => m.id), [materials]);
  const { data: rawData, isLoading, isError, error } = useQuery({
    queryKey: ['dashboardChart', title, materialIds, startDate, endDate, interval],
    queryFn: () => fetchPriceData(materialIds, startDate, endDate, interval),
    enabled: materialIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
  const chartData = useMemo(() => transformDataForChart(rawData || [], materials), [rawData, materials]);

  // --- [수정] 이 아래 return (JSX) 부분이 디자인 업그레이드의 핵심입니다 ---
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
            <div className="flex h-full items-center justify-center text-center text-sm text-red-500">
              데이터 로딩 실패<br/>({error.message})
            </div>
          ) : !chartData || chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              표시할 데이터가 없습니다.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                {/* [추가] 각 라인에 대한 그라데이션 정의 */}
                <defs>
                  {materials.map((material, index) => (
                    <linearGradient key={material.id} id={`gradient-${material.displayName}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.7} />
                      <stop offset="95%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>

                {/* [수정] 더 깔끔해진 축과 그리드 */}
                <XAxis dataKey="time_bucket" tick={{ fontSize: 10 }} stroke="#a1a1aa" tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value))}
                  domain={['dataMin - 100', 'dataMax + 100']}
                  stroke="#a1a1aa"
                  tickLine={false}
                  axisLine={false}
                />
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                
                {/* [교체] 커스텀 툴팁 적용 */}
                <Tooltip content={<CustomTooltip />} />
                
                <Legend iconSize={10} wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                {/* [추가] 그라데이션 영역 렌더링 */}
                {materials.map((material, index) => (
                  <Area
                    key={`${material.id}-area`}
                    type="natural"
                    dataKey={material.displayName}
                    stroke="none"
                    fill={`url(#gradient-${material.displayName})`}
                  />
                ))}

                {/* [수정] 선 스타일 업그레이드 */}
                {materials.map((material, index) => (
                  <Line
                    key={material.id}
                    type="natural" // 더 부드러운 곡선
                    dataKey={material.displayName}
                    name={material.displayName}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2.5} // 조금 더 두껍게
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 2, fill: '#fff' }} // 호버 시 강조 효과
                    connectNulls
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardMiniChart;