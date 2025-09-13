// src/components/materials/MaterialsChart.tsx
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

// Supabase 클라이언트 초기화 (환경 변수 사용 권장)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 데이터 페칭 함수
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

// 차트 데이터 형식 변환
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

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

const MaterialsChart: React.FC = () => {
  const {
    interval,
    setInterval,
    startDate,
    endDate,
    setDateRange,
    selectedMaterialsForChart,
    hiddenMaterials,
  } = useMaterialStore();

  const visibleMaterials = selectedMaterialsForChart.filter(m => !hiddenMaterials.has(m));

  const { data: rawData, isLoading, isError, error } = useQuery({
    queryKey: ['materialPrices', visibleMaterials, startDate, endDate, interval],
    queryFn: () => fetchPriceData(visibleMaterials, startDate, endDate, interval),
    enabled: visibleMaterials.length > 0, // 선택된 자재가 있을 때만 쿼리 실행
    staleTime: 1000 * 60 * 5, // 5분
  });

  const chartData = useMemo(() => transformDataForChart(rawData, visibleMaterials), [rawData, visibleMaterials]);

  // 가격 범위 분석하여 보조선 생성
  const referenceLines = useMemo(() => {
    if (!chartData || chartData.length === 0 || visibleMaterials.length < 2) return [];
    
    const allPrices: number[] = [];
    chartData.forEach(item => {
      visibleMaterials.forEach(material => {
        const price = (item as Record<string, number>)[material];
        if (typeof price === 'number' && !isNaN(price)) {
          allPrices.push(price);
        }
      });
    });
    
    if (allPrices.length === 0) return [];
    
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice;
    
    // 가격 차이가 큰 경우에만 보조선 추가 (범위가 평균의 50% 이상)
    const avgPrice = allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length;
    if (priceRange > avgPrice * 0.5) {
      const quarterLine = minPrice + priceRange * 0.25;
      const halfLine = minPrice + priceRange * 0.5;
      const threeQuarterLine = minPrice + priceRange * 0.75;
      
      return [
        { value: quarterLine, stroke: '#f0f0f0', strokeDasharray: '2 2' },
        { value: halfLine, stroke: '#d0d0d0', strokeDasharray: '4 4' },
        { value: threeQuarterLine, stroke: '#f0f0f0', strokeDasharray: '2 2' }
      ];
    }
    
    return [];
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
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="time_bucket" tick={{ fontSize: 12 }} />
                <YAxis 
                  tickFormatter={(value) => `₩${value.toFixed(1)}`}
                  tick={{ fontSize: 12 }}
                  domain={[(dataMin: number) => Math.max(0, dataMin * 0.95), (dataMax: number) => dataMax * 1.05]}
                />
                <Tooltip
                  formatter={(value: number) => [`₩${value.toFixed(1)}`, '가격']}
                  labelFormatter={(label) => `기간: ${label}`}
                />
                <Legend />
                {referenceLines.map((line, index) => (
                  <ReferenceLine
                    key={`ref-${index}`}
                    y={line.value}
                    stroke={line.stroke}
                    strokeDasharray={line.strokeDasharray}
                    strokeWidth={1}
                  />
                ))}
                {visibleMaterials.map((material, index) => (
                  <Line
                    key={material}
                    type="monotone"
                    dataKey={material}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
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