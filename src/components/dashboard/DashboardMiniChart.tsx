/**
 * DashboardMiniChart.tsx - 대시보드 미니 차트 컴포넌트
 * 
 * 기능:
 * - 선택된 자재들의 가격 변화를 라인 차트로 시각화
 * - React Query를 사용한 데이터 캐싱 및 상태 관리
 * - Zustand 스토어와 연동하여 날짜/기간 설정 공유
 * - 로딩/에러 상태 처리 및 스켈레톤 UI 제공
 * 
 * 연관 파일:
 * - src/components/dashboard/DashboardChartGrid.tsx (부모 컴포넌트)
 * - src/store/materialStore.ts (날짜/기간 설정 공유)
 * - src/lib/supabase.ts (데이터베이스 연동)
 * - src/components/ui/card.tsx, skeleton.tsx (UI 컴포넌트)
 * 
 * 중요도: ⭐⭐⭐ 필수 - 대시보드의 핵심 차트 기능
 * 
 * 데이터베이스 의존성:
 * - get_price_data RPC 함수 (Supabase)
 * - material_prices 테이블
 */
'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import {
  LineChart,
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

// Supabase 클라이언트 초기화 (환경변수에서 URL과 키 가져옴)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * 자재 가격 데이터를 Supabase에서 가져오는 함수
 * @param materials - 조회할 자재 specification 배열
 * @param startDate - 조회 시작 날짜
 * @param endDate - 조회 종료 날짜
 * @param interval - 데이터 집계 간격 (주간/월간/연간)
 * @returns 가격 데이터 배열
 */
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
    p_major_categories: null,
    p_middle_categories: null,
    p_sub_categories: null,
  });
  if (error) throw new Error(error.message);
  return data;
};

/**
 * DB에서 받은 데이터를 Recharts가 사용할 수 있는 형태로 변환합니다.
 * DB의 긴 specification 이름을 UI에 표시될 displayName으로 매핑합니다.
 * @param data - Supabase RPC로부터 받은 원본 데이터 배열
 * @param materialsMap - {id, displayName} 객체 배열
 * @returns Recharts에 적합한 데이터 배열
 */
const transformDataForChart = (
  data: any[],
  materialsMap: { id: string; displayName: string }[]
) => {
  if (!data || data.length === 0) return [];

  // id(긴 이름)를 displayName(짧은 이름)으로 빠르게 찾기 위한 맵 생성
  const displayNameMap = new Map(materialsMap.map(m => [m.id, m.displayName]));

  const groupedData = data.reduce((acc, item) => {
    const { time_bucket, specification, average_price } = item;

    // 현재 데이터의 긴 이름(specification)을 짧은 이름(displayName)으로 변환
    const displayName = displayNameMap.get(specification);

    // time_bucket을 기준으로 객체를 생성하거나 기존 객체를 사용
    if (!acc[time_bucket]) {
      acc[time_bucket] = { time_bucket };
    }

    // 짧은 이름을 key로 사용하여 평균 가격 데이터를 저장
    if (displayName) {
      acc[time_bucket][displayName] = parseFloat(average_price);
    }

    return acc;
  }, {});

  return Object.values(groupedData);
};

// 차트 라인 색상 팔레트 (최대 6개 자재까지 지원)
const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

// 자재 정보 타입 정의
interface MaterialInfo {
  id: string;           // DB의 specification과 일치하는 실제 값
  displayName: string;  // UI에 표시될 짧은 이름
}

// 컴포넌트 Props 타입 정의
interface DashboardMiniChartProps {
  title: string;        // 차트 제목
  materials: MaterialInfo[];  // 표시할 자재 목록
}

const DashboardMiniChart: React.FC<DashboardMiniChartProps> = ({ title, materials }) => {
  // Zustand 스토어에서 공통 날짜/기간 설정을 가져옴
  const { interval, startDate, endDate } = useMaterialStore();

  // DB에 쿼리할 실제 ID(긴 이름) 목록을 props로부터 추출
  const materialIds = useMemo(() => materials.map(m => m.id), [materials]);

  // React Query를 사용하여 데이터 페칭
  const { data: rawData, isLoading, isError, error } = useQuery({
    queryKey: ['dashboardChart', title, materialIds, startDate, endDate, interval],
    queryFn: () => fetchPriceData(materialIds, startDate, endDate, interval),
    enabled: materialIds.length > 0, // 조회할 자재가 있을 때만 쿼리 실행
    staleTime: 1000 * 60 * 5, // 5분 동안 캐시 유지
  });

  // DB에서 받아온 데이터를 차트용으로 가공
  const chartData = useMemo(() => transformDataForChart(rawData || [], materials), [rawData, materials]);

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
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                <XAxis dataKey="time_bucket" tick={{ fontSize: 10 }} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value))}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  wrapperClassName="text-xs"
                  formatter={(value: number) => `₩${value.toLocaleString()}`}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                {materials.map((material, index) => (
                  <Line
                    key={material.id} // 고유 키는 실제 DB ID를 사용
                    type="monotone"
                    dataKey={material.displayName} // 차트 데이터 키는 짧은 이름을 사용
                    name={material.displayName} // 범례(Legend)에 표시될 이름
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls // 데이터가 중간에 비어있어도 라인을 연결
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
