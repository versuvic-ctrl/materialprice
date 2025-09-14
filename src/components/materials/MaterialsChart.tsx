// src/components/materials/MaterialsChart.tsx
'use client';

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import useMaterialStore from '@/store/materialStore';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 초기화 (lib/supabaseClient.ts에서 가져와도 무방합니다)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// [유지] 자재명을 간략하게 표시하는 함수
const shortenMaterialName = (name: string): string => {
    if (name.includes('SUS304')) return 'SUS304';
    if (name.includes('SUS316')) return 'SUS316';
    if (name.includes('AL6061')) return 'AL6061';
    if (name.includes('고장력철근')) return '고장력철근';
    if (name.includes('H형강')) return 'H형강';
    if (name.includes('COPPER')) return '구리';
    if (name.includes('NICKEL')) return '니켈';
    if (name.includes('SILVER')) return '은';
    if (name.includes('PTFE')) return 'PTFE';
    if (name.includes('ABS')) return 'ABS';
    if (name.includes('PC')) return 'PC';
    if (name.includes('HDPE')) return 'HDPE';
    
    const words = name.split(/[\s-_]+/);
    if (words[0] && words[0].length <= 20) return words[0];
    return name.length > 20 ? name.substring(0, 20) + '...' : name;
};

// [유지] 숫자에 천 단위 구분자 추가하는 함수
const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('ko-KR').format(value);
};

// 단위 정보를 포함한 툴팁 포맷팅 함수
const formatTooltipValue = (value: number, unit?: string): string => {
  return `${new Intl.NumberFormat('ko-KR').format(value)}${unit ? ` ${unit}` : ''}`;
};

// Y축 도메인 계산 함수 (패딩 포함)
const calculateYAxisDomain = (data: any[], materials: string[]) => {
  if (!data.length) return ['auto', 'auto'];
  
  const allValues: number[] = [];
  data.forEach(item => {
    materials.forEach(material => {
      if (item[material] !== undefined && item[material] !== null) {
        allValues.push(item[material]);
      }
    });
  });
  
  if (allValues.length === 0) return ['auto', 'auto'];
  
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const range = maxValue - minValue;
  const padding = range * 0.1; // 10% padding
  
  return [
    Math.max(0, minValue - padding),
    maxValue + padding
  ];
};

// [수정] 데이터 페칭 함수 - Supabase RPC 호출은 동일하나, 이제 완벽한 데이터를 반환합니다.
const fetchPriceData = async (
  materials: string[],
  startDate: string,
  endDate: string,
  interval: 'weekly' | 'monthly' | 'yearly'
) => {
  if (materials.length === 0) return [];

  const { data, error } = await supabase.rpc('get_price_data', {
    p_start_date: startDate,
    p_end_date: endDate,
    p_interval: interval,
    p_major_categories: null,
    p_middle_categories: null,
    p_sub_categories: null,
    p_specifications: materials,
  });

  if (error) {
    console.error('Error fetching price data:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      fullError: JSON.stringify(error, null, 2)
    });
    throw new Error(`Supabase RPC Error: ${error.message || error.details || 'Unknown error'}`);
  }

  return data;
};

// [수정] 차트 데이터 변환 함수 - 배열 타입 보장
const transformDataForChart = (data: any[], visibleMaterials: string[]) => {
  if (!data || !Array.isArray(data) || data.length === 0) return [];

  const groupedData = data.reduce((acc, item) => {
    const { time_bucket, specification, average_price } = item;
    
    if (!acc[time_bucket]) {
      acc[time_bucket] = { time_bucket };
    }
    acc[time_bucket][specification] = parseFloat(average_price);
    return acc;
  }, {});
  
  // Object.values() 결과를 명시적으로 배열로 변환
  const resultArray = Array.from(Object.values(groupedData));
  
  const result = resultArray.map((group: any) => {
      visibleMaterials.forEach(material => {
          if (!(material in group)) {
              group[material] = null; // 데이터 없는 부분은 null로 채워 'connectNulls'가 잘 동작하도록 함
          }
      });
      return group;
  });
  
  // 날짜순으로 정렬 - 배열임을 보장
  return Array.isArray(result) ? result.sort((a, b) => a.time_bucket.localeCompare(b.time_bucket)) : [];
};

// [삭제] assignYAxis 함수는 더 이상 필요하지 않습니다.

// [유지] 색상 팔레트
const COLORS = [
  '#6366f1', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

// Y축 가격 포맷팅 함수
const formatYAxisPrice = (value: number): string => {
  // 모든 가격을 원 단위로 표시
  return `${value.toLocaleString('ko-KR', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  })}원`;
};

// [유지] 커스텀 범례 컴포넌트
const CustomizedLegend = (props: any) => {
  const { payload, visibleMaterials } = props;

  if (!payload || !visibleMaterials || visibleMaterials.length === 0) return null;

  // 단순화된 규칙에 따라 범례 아이템을 좌/우로 분리
  const leftPayload = payload.filter((p: any) => p.dataKey === visibleMaterials[0]);
  const rightPayload = payload.filter((p: any) => visibleMaterials.slice(1).includes(p.dataKey as string));

  return (
    <div className="flex justify-between items-start px-2 text-xs pointer-events-none">
      <div className="flex flex-col items-start bg-white/70 p-1 rounded">
        {leftPayload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center space-x-1 mb-1">
            <div style={{ width: 8, height: 8, backgroundColor: entry.color }} />
            <span className="text-xs">{shortenMaterialName(entry.value as string)} (좌)</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-end bg-white/70 p-1 rounded">
        {rightPayload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center space-x-1 mb-1">
            <span className="text-xs">(우) {shortenMaterialName(entry.value as string)}</span>
            <div style={{ width: 8, height: 8, backgroundColor: entry.color }} />
          </div>
        ))}
      </div>
    </div>
  );
};


const MaterialsChart: React.FC = () => {
  const {
    interval, setInterval, startDate, endDate, setDateRange,
    selectedMaterialsForChart, hiddenMaterials,
  } = useMaterialStore();

  const visibleMaterials = selectedMaterialsForChart.filter(m => !hiddenMaterials.has(m));

  const { data: rawData, isLoading, isError, error } = useQuery({
    queryKey: ['materialPrices', visibleMaterials, startDate, endDate, interval],
    queryFn: () => fetchPriceData(visibleMaterials, startDate, endDate, interval),
    enabled: visibleMaterials.length > 0,
    staleTime: 1000 * 60 * 5, // 5분
  });
  
  const chartData = useMemo(() => {
    const transformed = transformDataForChart(rawData, visibleMaterials);
    return Array.isArray(transformed) ? transformed : [];
  }, [rawData, visibleMaterials]);
  
  const rightAxisMaterials = visibleMaterials.length > 1 ? visibleMaterials.slice(1) : [];
  
  // 단위 정보 추출 (첫 번째 데이터에서)
  const unit = useMemo(() => {
    if (rawData && rawData.length > 0) {
      return rawData[0].unit || '';
    }
    return '';
  }, [rawData]);
  
  // 좌측 Y축 도메인 계산 (첫 번째 자재)
  const leftYAxisDomain = useMemo(() => {
    const leftMaterials = visibleMaterials.length > 0 ? [visibleMaterials[0]] : [];
    return calculateYAxisDomain(chartData, leftMaterials);
  }, [chartData, visibleMaterials]);

  // 우측 Y축 도메인 계산 (나머지 자재들)
  const rightYAxisDomain = useMemo(() => {
    const rightMaterials = visibleMaterials.length > 1 ? visibleMaterials.slice(1) : [];
    return calculateYAxisDomain(chartData, rightMaterials);
  }, [chartData, visibleMaterials]);

  // 범례 높이 계산 (동적 공간 확보)
  const legendHeight = useMemo(() => {
    if (visibleMaterials.length === 0) return 0;
    const leftItems = visibleMaterials.length > 0 ? 1 : 0;
    const rightItems = visibleMaterials.length > 1 ? visibleMaterials.length - 1 : 0;
    const maxItems = Math.max(leftItems, rightItems);
    return maxItems * 18 + 8; // 각 아이템당 18px + 최소 패딩 8px
  }, [visibleMaterials]);

  // 차트 높이 계산 (범례 공간 확보)
  const chartHeight = useMemo(() => {
    return 340 + legendHeight; // 기본 340px + 범례 높이
  }, [legendHeight]);

  return (
    <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
        <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
          <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
          실시간 자재 가격 비교 분석
          {selectedMaterialsForChart.length > 0 && (
            <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
              {visibleMaterials.length}개 표시
            </span>
          )}
          {unit && (
            <span className="text-sm font-normal text-gray-500">({unit})</span>
          )}
        </CardTitle>
        <div className="flex justify-end items-center gap-3 pt-3">
          <Select value={interval} onValueChange={(value: any) => setInterval(value)}>
            <SelectTrigger className="w-28 h-9 border-gray-300 hover:border-gray-400 transition-colors">
              <SelectValue placeholder="기간" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">주간</SelectItem>
              <SelectItem value="monthly">월간</SelectItem>
              <SelectItem value="yearly">연간</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={startDate} onChange={(e) => setDateRange(e.target.value, endDate)} className="w-40 h-9 border-gray-300 hover:border-gray-400 transition-colors" />
          <Input type="date" value={endDate} onChange={(e) => setDateRange(startDate, e.target.value)} className="w-40 h-9 border-gray-300 hover:border-gray-400 transition-colors" />
        </div>
      </CardHeader>
      <CardContent className="p-6 bg-white">
        <div 
          className="bg-white rounded-lg p-2 border-0 shadow-none relative"
          style={{ height: `${chartHeight}px` }}
        >
          {isLoading ? (
            <div className="space-y-4"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-64 w-full" /></div>
          ) : isError ? (
            <div className="text-red-500 text-center py-8 bg-red-50 rounded-lg border border-red-200"><div className="text-red-600 font-medium">데이터 로딩 실패: {error.message}</div></div>
          ) : !chartData || chartData.length === 0 ? (
            <div className="text-gray-500 text-center py-8 bg-gray-50 rounded-lg border border-gray-200"><div className="text-gray-600 font-medium">표시할 데이터가 없거나, 조회할 자재를 선택해주세요.</div></div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 2" horizontal={true} vertical={true} stroke="#d1d5db" opacity={0.5} />
                  <XAxis dataKey="time_bucket" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={true} tick={{ fill: '#6b7280', fontWeight: 500 }} />
                  
                  <YAxis yAxisId="left" stroke="#6b7280" tickFormatter={formatYAxisPrice} fontSize={12} tickLine={false} axisLine={true} tick={{ fill: '#6b7280', fontWeight: 500 }} domain={leftYAxisDomain} />
                  
                  {rightAxisMaterials.length > 0 && (
                    <YAxis yAxisId="right" orientation="right" stroke="#6b7280" tickFormatter={formatYAxisPrice} fontSize={12} tickLine={false} axisLine={true} tick={{ fill: '#6b7280', fontWeight: 500 }} domain={rightYAxisDomain} />
                  )}

                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '14px', fontWeight: 500 }}
                    labelStyle={{ color: '#374151', fontWeight: 600 }}
                    formatter={(value: number, name: string) => [formatTooltipValue(value, unit), shortenMaterialName(name)]}
                    labelFormatter={(label) => `기간: ${label}`}
                  />

                  {visibleMaterials.map((material, index) => (
                    <Line
                      key={material}
                      yAxisId={index === 0 ? 'left' : 'right'} // [핵심] 첫 번째는 left, 나머지는 right
                      type="monotone"
                      dataKey={material}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={3}
                      dot={{ 
                        fill: COLORS[index % COLORS.length], 
                        strokeWidth: 2, 
                        r: 4,
                        stroke: 'white'
                      }}
                      activeDot={{ 
                        r: 6, 
                        stroke: COLORS[index % COLORS.length],
                        strokeWidth: 2,
                        fill: 'white'
                      }}
                      connectNulls // [핵심] 데이터가 null인 부분을 이어줍니다.
                    />
                  ))}
                </LineChart>
               </ResponsiveContainer>
               {visibleMaterials.length > 0 && (
                 <div style={{ marginTop: '8px' }}>
                   <CustomizedLegend payload={chartData.length > 0 ? visibleMaterials.map((material, index) => ({ 
                     value: material, 
                     color: COLORS[index % COLORS.length], 
                     dataKey: material 
                   })) : []} visibleMaterials={visibleMaterials} />
                 </div>
               )}
             </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MaterialsChart;