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
import PriceTable, { MaterialPriceData } from './PriceTable';
import { convertToKgUnit, calculatePriceChange } from '@/utils/unitConverter';

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
    p_start_date: startDate,
    p_end_date: endDate,
    p_interval: interval,
    p_major_categories: null,
    p_middle_categories: null,
    p_sub_categories: null,
    p_specifications: materials,
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

    // 짧은 이름을 key로 사용하여 평균 가격 데이터를 저장 (단위 변환 적용)
    if (displayName) {
      const rawPrice = parseFloat(average_price);
      // Supabase RPC 'get_price_data'가 'unit' 필드를 반환하지 않는 것으로 추정됨.
      // 데이터베이스의 모든 단위가 '원/톤'이므로 'ton'으로 강제 변환합니다.
      const originalUnit = 'ton';
      const convertedPrice = convertToKgUnit(rawPrice, originalUnit);
      acc[time_bucket][displayName] = convertedPrice.price;
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

  // 테이블용 데이터 생성 (최신 가격과 변동률 계산)
  const tableData = useMemo((): MaterialPriceData[] => {
    if (!rawData || rawData.length === 0) return [];

    return materials.map(material => {
      // 해당 자재의 모든 데이터 필터링
      const materialData = rawData.filter(item => item.specification === material.id);
      
      if (materialData.length === 0) {
        return {
          name: material.displayName,
          currentPrice: 0,
          unit: 'kg',
          monthlyChange: 0,
          yearlyChange: 0,
        };
      }

      // 날짜순 정렬 (최신순)
      const sortedData = materialData.sort((a, b) => new Date(b.time_bucket).getTime() - new Date(a.time_bucket).getTime());
      
      const rawPrice = parseFloat(sortedData[0]?.average_price || '0');
      // Supabase RPC 'get_price_data'가 'unit' 필드를 반환하지 않는 것으로 추정됨.
      // 데이터베이스의 모든 단위가 '원/톤'이므로 'ton'으로 강제 변환합니다.
      const originalUnit = 'ton';
      
      // 단위 변환 유틸리티 사용
      const convertedCurrent = convertToKgUnit(rawPrice, originalUnit);
      const currentPrice = convertedCurrent.price;
      const displayUnit = convertedCurrent.unit;
      
      // 전월비 계산 (1개월 전 데이터와 비교)
      let monthlyChange = 0;
      if (sortedData.length >= 2) {
        const previousRawPrice = parseFloat(sortedData[1]?.average_price || '0');
        monthlyChange = calculatePriceChange(rawPrice, previousRawPrice, originalUnit);
      }

      // 전년비 계산 (12개월 전 데이터와 비교, 또는 가장 오래된 데이터와 비교)
      let yearlyChange = 0;
      const yearAgoIndex = Math.min(12, sortedData.length - 1);
      if (yearAgoIndex > 0) {
        const yearAgoRawPrice = parseFloat(sortedData[yearAgoIndex]?.average_price || '0');
        yearlyChange = calculatePriceChange(rawPrice, yearAgoRawPrice, originalUnit);
      }

      return {
        name: material.displayName,
        currentPrice,
        unit: displayUnit,
        monthlyChange,
        yearlyChange,
      };
    });
  }, [rawData, materials]);

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-md font-semibold flex justify-between items-center">
          <span>{title}</span>
          <span className="text-sm font-normal text-gray-500">(원/kg)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className="h-64 w-full relative">
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
              <LineChart data={chartData} margin={{ top: 2, right: 2, left: 1, bottom: 2 }}>
                <CartesianGrid strokeDasharray="2 2" strokeOpacity={0.5} vertical={true} />
                <XAxis dataKey="time_bucket" tick={{ fontSize: 10 }} />
                <YAxis
                  width={80}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={(value) => `${value.toLocaleString('ko-KR')}원`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  wrapperClassName="text-xs"
                  formatter={(value: number, name: string) => {
                    // 이미 변환된 kg 단위 가격을 그대로 표시
                    return [`${value.toLocaleString('ko-KR')}원/kg`, name];
                  }}
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
                    dot={{ r: 1.5, strokeWidth: 1, fill: COLORS[index % COLORS.length] }} // 노드 크기를 더 작게 조정
                    activeDot={{ r: 3, strokeWidth: 1 }} // 호버 시 노드 크기 증가
                    connectNulls // 데이터가 중간에 비어있어도 라인을 연결
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        
        {/* 가격 정보 테이블 */}
        <PriceTable data={tableData} isLoading={isLoading} />
      </CardContent>
    </Card>
  );
};

export default DashboardMiniChart;
