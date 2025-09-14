/**
 * MaterialsChart.tsx - 자재 가격 추이 메인 차트 컴포넌트
 * 
 * 기능:
 * - 선택된 자재들의 가격 변화를 상세한 라인 차트로 시각화
 * - 이중 Y축 지원 (가격 차이가 큰 자재들을 함께 표시)
 * - 날짜 범위 및 집계 간격 설정 UI 제공
 * - React Query를 사용한 데이터 캐싱 및 상태 관리
 * - Zustand 스토어와 연동하여 자재 선택 상태 공유
 * 
 * 연관 파일:
 * - src/app/materials/page.tsx (자재 페이지에서 사용)
 * - src/store/materialStore.ts (자재 선택 및 설정 상태 관리)
 * - src/lib/supabase.ts (데이터베이스 연동)
 * - src/components/ui/* (UI 컴포넌트들)
 * 
 * 중요도: ⭐⭐⭐ 필수 - 자재 분석의 핵심 차트 기능
 * 
 * 데이터베이스 의존성:
 * - get_price_data RPC 함수 (Supabase)
 * - material_prices 테이블
 */
'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import useMaterialStore from '@/store/materialStore';
import { createClient } from '@supabase/supabase-js';

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
  if (materials.length === 0) return [];

  const { data, error } = await supabase.rpc('get_price_data', {
    p_specifications: materials,
    p_start_date: startDate,
    p_end_date: endDate,
    p_interval: interval,
    // 다른 카테고리 필터는 필요 시 추가
    p_major_categories: null,
    p_middle_categories: null,
    p_sub_categories: null,
  });

  if (error) {
    console.error('Error fetching price data:', error);
    throw new Error(error.message);
  }

  return data;
};

/**
 * DB에서 받은 데이터를 Recharts가 사용할 수 있는 형태로 변환
 * @param data - Supabase RPC로부터 받은 원본 데이터 배열
 * @param materials - 자재 목록 (현재 미사용)
 * @returns Recharts에 적합한 데이터 배열
 */
const transformDataForChart = (data: any[], materials: string[]) => {
  if (!data || data.length === 0) return [];
  
  const groupedData = data.reduce((acc, item) => {
    const { time_bucket, specification, average_price } = item;
    if (!acc[time_bucket]) {
      acc[time_bucket] = { time_bucket };
    }
    acc[time_bucket][specification] = parseFloat(average_price);
    return acc;
  }, {});

  return Object.values(groupedData);
};

// 차트 라인 색상 팔레트 (최대 6개 자재까지 지원)
const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

const MaterialsChart: React.FC = () => {
  // Zustand 스토어에서 차트 설정 및 자재 선택 상태 가져오기
  const {
    interval,                    // 집계 간격 (주간/월간/연간)
    setInterval,                 // 집계 간격 설정 함수
    startDate,                   // 조회 시작 날짜
    endDate,                     // 조회 종료 날짜
    setDateRange,                // 날짜 범위 설정 함수
    selectedMaterialsForChart,   // 차트에 표시할 선택된 자재들
    hiddenMaterials,             // 숨김 처리된 자재들 (Set)
  } = useMaterialStore();

  // 숨김 처리되지 않은 자재들만 필터링
  const visibleMaterials = selectedMaterialsForChart.filter(m => !hiddenMaterials.has(m));

  const { data: rawData, isLoading, isError, error } = useQuery({
    queryKey: ['materialPrices', visibleMaterials, startDate, endDate, interval],
    queryFn: () => fetchPriceData(visibleMaterials, startDate, endDate, interval),
    enabled: visibleMaterials.length > 0, // 선택된 자재가 있을 때만 쿼리 실행
    staleTime: 1000 * 60 * 5, // 5분
  });

  const chartData = useMemo(() => transformDataForChart(rawData, visibleMaterials), [rawData, visibleMaterials]);

  /**
   * 가격 범위 분석 및 이중 Y축 그룹 분할
   * 가격 차이가 10배 이상 나는 자재들을 주축/보조축으로 분리하여
   * 모든 자재의 변화를 명확하게 볼 수 있도록 함
   */
  const { primaryMaterials, secondaryMaterials, needsSecondaryAxis } = useMemo(() => {
    if (!chartData || chartData.length === 0 || visibleMaterials.length < 2) {
      return { 
        primaryMaterials: visibleMaterials, 
        secondaryMaterials: [], 
        needsSecondaryAxis: false 
      };
    }
    
    // 각 자재의 평균 가격 계산
    const materialAvgPrices = visibleMaterials.map(material => {
      const prices: number[] = [];
      chartData.forEach(item => {
        const price = (item as Record<string, number>)[material];
        if (typeof price === 'number' && !isNaN(price)) {
          prices.push(price);
        }
      });
      const avgPrice = prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 0;
      return { material, avgPrice };
    });
    
    // 가격 순으로 정렬
    materialAvgPrices.sort((a, b) => a.avgPrice - b.avgPrice);
    
    if (materialAvgPrices.length < 2) {
      return { 
        primaryMaterials: visibleMaterials, 
        secondaryMaterials: [], 
        needsSecondaryAxis: false 
      };
    }
    
    const minPrice = materialAvgPrices[0].avgPrice;
    const maxPrice = materialAvgPrices[materialAvgPrices.length - 1].avgPrice;
    
    // 가격 차이가 10배 이상이면 보조 Y축 사용
    const priceRatio = maxPrice / (minPrice || 1);
    const needsSecondary = priceRatio >= 10;
    
    if (!needsSecondary) {
      return { 
        primaryMaterials: visibleMaterials, 
        secondaryMaterials: [], 
        needsSecondaryAxis: false 
      };
    }
    
    // 중간값을 기준으로 분할
    const medianIndex = Math.floor(materialAvgPrices.length / 2);
    const primary = materialAvgPrices.slice(0, medianIndex).map(item => item.material);
    const secondary = materialAvgPrices.slice(medianIndex).map(item => item.material);
    
    return { 
      primaryMaterials: primary, 
      secondaryMaterials: secondary, 
      needsSecondaryAxis: true 
    };
  }, [chartData, visibleMaterials]);

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-800">
          자재 가격 추이
          {selectedMaterialsForChart.length > 0 && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({visibleMaterials.length}개 자재 표시 중)
            </span>
          )}
        </CardTitle>
        <div className="flex justify-end items-center gap-4 pt-2">
            <Select value={interval} onValueChange={(value: any) => setInterval(value)}>
                <SelectTrigger className="w-24">
                    <SelectValue placeholder="기간" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="weekly">주간</SelectItem>
                    <SelectItem value="monthly">월간</SelectItem>
                    <SelectItem value="yearly">연간</SelectItem>
                </SelectContent>
            </Select>
            <Input
                type="date"
                value={startDate}
                onChange={(e) => setDateRange(e.target.value, endDate)}
                className="w-40"
            />
            <Input
                type="date"
                value={endDate}
                onChange={(e) => setDateRange(startDate, e.target.value)}
                className="w-40"
            />
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : isError ? (
            <div className="flex items-center justify-center h-full text-red-500">
              데이터 로딩 실패: {error.message}
            </div>
          ) : !chartData || chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              표시할 데이터가 없거나, 조회할 자재를 선택해주세요.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: needsSecondaryAxis ? 60 : 20, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="time_bucket" tick={{ fontSize: 12 }} />
                
                {/* 주 Y축 (왼쪽) - 낮은 가격대 자재용 */}
                <YAxis 
                  yAxisId="primary"
                  tickFormatter={(value) => `₩${value.toFixed(1)}`}
                  tick={{ fontSize: 12 }}
                  domain={[(dataMin: number) => Math.max(0, dataMin * 0.95), (dataMax: number) => dataMax * 1.05]}
                />
                
                {/* 보조 Y축 (오른쪽) - 높은 가격대 자재용 */}
                {needsSecondaryAxis && (
                  <YAxis 
                    yAxisId="secondary"
                    orientation="right"
                    tickFormatter={(value) => `₩${value.toFixed(1)}`}
                    tick={{ fontSize: 12 }}
                    domain={[(dataMin: number) => Math.max(0, dataMin * 0.95), (dataMax: number) => dataMax * 1.05]}
                  />
                )}
                
                <Tooltip
                  formatter={(value: number, name: string) => {
                    const axis = needsSecondaryAxis && secondaryMaterials.includes(name) ? '(우축)' : '(좌축)';
                    return [`₩${value.toFixed(1)} ${axis}`, name];
                  }}
                  labelFormatter={(label) => `기간: ${label}`}
                />
                
                <Legend 
                  formatter={(value: string) => {
                    if (needsSecondaryAxis) {
                      const axis = secondaryMaterials.includes(value) ? '(우축)' : '(좌축)';
                      return `${value} ${axis}`;
                    }
                    return value;
                  }}
                />
                
                {/* 주 Y축 자재들 (낮은 가격대) */}
                {primaryMaterials.map((material, index) => (
                  <Line
                    key={material}
                    yAxisId="primary"
                    type="monotone"
                    dataKey={material}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
                
                {/* 보조 Y축 자재들 (높은 가격대) */}
                {needsSecondaryAxis && secondaryMaterials.map((material, index) => (
                  <Line
                    key={material}
                    yAxisId="secondary"
                    type="monotone"
                    dataKey={material}
                    stroke={COLORS[(primaryMaterials.length + index) % COLORS.length]}
                    strokeWidth={2}
                    strokeDasharray="5 5" // 보조축 라인은 점선으로 구분
                    dot={false}
                    connectNulls
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

export default MaterialsChart;