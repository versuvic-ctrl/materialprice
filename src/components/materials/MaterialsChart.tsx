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
import { convertChartDataToKg, normalizeUnitDisplay } from '@/utils/unitConverter';

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

// 자재별 가격 범위 분석 함수
const analyzePriceRange = (data: any[], material: string) => {
  if (!data || data.length === 0) {
    return { min: 0, max: 0, range: 0 };
  }

  let min = Infinity;
  let max = -Infinity;

  data.forEach(item => {
    const value = item[material];
    if (value !== null && value !== undefined && !isNaN(value)) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  });

  if (min === Infinity || max === -Infinity) {
    return { min: 0, max: 0, range: 0 };
  }

  return {
    min,
    max,
    range: max - min
  };
};

// 가격 범위 차이 비율 계산 (큰 범위 대비 작은 범위의 비율)
const calculateRangeDifferenceRatio = (range1: number, range2: number) => {
  if (range1 === 0 && range2 === 0) return 0;
  if (range1 === 0 || range2 === 0) return Infinity;
  
  const largerRange = Math.max(range1, range2);
  const smallerRange = Math.min(range1, range2);
  
  return largerRange / smallerRange;
};

// 스마트 축 배치 알고리즘
const calculateSmartAxisAssignment = (data: any[], materials: string[]): {
  leftAxisMaterials: string[];
  rightAxisMaterials: string[];
  leftAxisDomain: any[];
  rightAxisDomain: any[];
} => {
  if (!data || data.length === 0 || materials.length === 0) {
    return {
      leftAxisMaterials: [],
      rightAxisMaterials: [],
      leftAxisDomain: ['dataMin - 100', 'dataMax + 100'],
      rightAxisDomain: ['dataMin - 100', 'dataMax + 100']
    };
  }

  // 각 자재의 가격 범위 분석
  const materialRanges = materials.map(material => ({
    material,
    ...analyzePriceRange(data, material)
  }));

  // 첫 번째 자재는 무조건 주축(좌측)
  const leftAxisMaterials = [materialRanges[0].material];
  const rightAxisMaterials: string[] = [];

  let leftAxisRange = materialRanges[0];

  // 두 번째 자재부터 처리
  for (let i = 1; i < materialRanges.length; i++) {
    const currentMaterial = materialRanges[i];
    
    // 현재 좌축 범위와의 차이 비율 계산
    const ratioWithLeft = calculateRangeDifferenceRatio(
      leftAxisRange.range, 
      currentMaterial.range
    );

    // 우축이 비어있거나, 좌축과의 차이가 5배 미만이면 좌축에 배치
    if (rightAxisMaterials.length === 0 && ratioWithLeft < 5) {
      leftAxisMaterials.push(currentMaterial.material);
      // 좌축 범위 업데이트 (통합된 범위)
      leftAxisRange = {
        material: 'combined',
        min: Math.min(leftAxisRange.min, currentMaterial.min),
        max: Math.max(leftAxisRange.max, currentMaterial.max),
        range: Math.max(leftAxisRange.max, currentMaterial.max) - 
               Math.min(leftAxisRange.min, currentMaterial.min)
      };
    } else {
      // 우축이 있는 경우, 좌축과 우축 중 더 적합한 곳에 배치
      if (rightAxisMaterials.length > 0) {
        // 현재 우축 범위 계산
        const rightAxisRange = rightAxisMaterials.reduce((acc, mat) => {
          const range = materialRanges.find(r => r.material === mat)!;
          return {
            min: Math.min(acc.min, range.min),
            max: Math.max(acc.max, range.max),
            range: Math.max(acc.max, range.max) - Math.min(acc.min, range.min)
          };
        }, { min: Infinity, max: -Infinity, range: 0 });

        const ratioWithRight = calculateRangeDifferenceRatio(
          rightAxisRange.range,
          currentMaterial.range
        );

        // 좌축과 우축 중 더 적합한 곳에 배치
        if (ratioWithLeft <= ratioWithRight) {
          leftAxisMaterials.push(currentMaterial.material);
          leftAxisRange = {
            material: 'combined',
            min: Math.min(leftAxisRange.min, currentMaterial.min),
            max: Math.max(leftAxisRange.max, currentMaterial.max),
            range: Math.max(leftAxisRange.max, currentMaterial.max) - 
                   Math.min(leftAxisRange.min, currentMaterial.min)
          };
        } else {
          rightAxisMaterials.push(currentMaterial.material);
        }
      } else {
        // 우축이 비어있고 좌축과 차이가 5배 이상이면 우축에 배치
        rightAxisMaterials.push(currentMaterial.material);
      }
    }
  }

  // 각 축의 도메인 계산
  const leftAxisDomain = calculateYAxisDomain(data, leftAxisMaterials);
  const rightAxisDomain = rightAxisMaterials.length > 0 
    ? calculateYAxisDomain(data, rightAxisMaterials)
    : ['dataMin - 100', 'dataMax + 100'];

  return {
    leftAxisMaterials,
    rightAxisMaterials,
    leftAxisDomain,
    rightAxisDomain
  };
};

// Y축 눈금 간격을 계산하는 함수
const calculateTickInterval = (min: number, max: number, targetTickCount: number = 5): number => {
  const range = max - min;
  if (range === 0) return 1;
  
  // 기본 간격 계산
  const rawInterval = range / (targetTickCount - 1);
  
  // 10의 거듭제곱으로 정규화
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
  const normalizedInterval = rawInterval / magnitude;
  
  // 적절한 간격 선택 (1, 2, 5, 10의 배수)
  let niceInterval;
  if (normalizedInterval <= 1) {
    niceInterval = 1;
  } else if (normalizedInterval <= 2) {
    niceInterval = 2;
  } else if (normalizedInterval <= 5) {
    niceInterval = 5;
  } else {
    niceInterval = 10;
  }
  
  return niceInterval * magnitude;
};

// 명확한 기준으로 Y축 도메인과 눈금을 계산하는 함수
const calculateSmartYAxisDomain = (data: any[], materials: string[]): [number, number, number[]] => {
  if (!data || data.length === 0 || materials.length === 0) {
    return [0, 1000, [0, 250, 500, 750, 1000]];
  }

  let min = Infinity;
  let max = -Infinity;

  data.forEach(item => {
    materials.forEach(material => {
      const value = item[material];
      if (value !== null && value !== undefined && !isNaN(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    });
  });

  if (min === Infinity || max === -Infinity) {
    return [0, 1000, [0, 250, 500, 750, 1000]];
  }

  // 적절한 눈금 간격 계산
  const tickInterval = calculateTickInterval(min, max, 5);
  
  // 도메인 범위를 눈금에 맞춰 조정
  const domainMin = Math.floor(min / tickInterval) * tickInterval;
  const domainMax = Math.ceil(max / tickInterval) * tickInterval;
  
  // 눈금 배열 생성
  const ticks: number[] = [];
  for (let tick = domainMin; tick <= domainMax; tick += tickInterval) {
    ticks.push(tick);
  }
  
  // 최소 3개, 최대 7개의 눈금 보장
  if (ticks.length < 3) {
    const additionalTicks = Math.ceil((3 - ticks.length) / 2);
    const newMin = domainMin - (additionalTicks * tickInterval);
    const newMax = domainMax + (additionalTicks * tickInterval);
    
    ticks.length = 0;
    for (let tick = newMin; tick <= newMax; tick += tickInterval) {
      ticks.push(tick);
    }
  }
  
  return [ticks[0], ticks[ticks.length - 1], ticks];
};

// Y축 도메인 계산 함수 (패딩 포함) - 개선된 버전
const calculateYAxisDomain = (data: any[], materials: string[]) => {
  const [domainMin, domainMax, ticks] = calculateSmartYAxisDomain(data, materials);
  return [domainMin, domainMax];
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

// [수정] 커스텀 범례 컴포넌트 - 실제 축 배치에 따른 범례 배치
const CustomizedLegend = (props: any) => {
  const { payload, visibleMaterials, axisAssignment } = props;

  if (!payload || !visibleMaterials || visibleMaterials.length === 0 || !axisAssignment) return null;

  // 실제 축 배치에 따라 범례 아이템을 좌/우로 분리
  const leftPayload = payload.filter((p: any) => 
    axisAssignment.leftAxisMaterials.includes(p.dataKey)
  );
  const rightPayload = payload.filter((p: any) => 
    axisAssignment.rightAxisMaterials.includes(p.dataKey)
  );

  return (
    <div className="flex justify-between items-start px-2 text-xs pointer-events-none">
      <div className="flex flex-col items-start bg-white/70 p-1 rounded">
        {leftPayload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center space-x-1 mb-1">
            <div style={{ width: 8, height: 8, backgroundColor: entry.color }} />
            <span className="text-xs">{shortenMaterialName(entry.value as string)} (주축)</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-end bg-white/70 p-1 rounded">
        {rightPayload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center space-x-1 mb-1">
            <span className="text-xs">(보조축) {shortenMaterialName(entry.value as string)}</span>
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
    const chartArray = Array.isArray(transformed) ? transformed : [];
    
    // 단위 변환 적용 - 원/톤을 원/kg로 변환
    if (chartArray.length > 0 && rawData && rawData.length > 0) {
      const originalUnit = rawData[0]?.unit || '원/톤';
      return convertChartDataToKg(chartArray, visibleMaterials, originalUnit);
    }
    
    return chartArray;
  }, [rawData, visibleMaterials]);
  
  // 스마트 Y축 배치 계산
  const axisAssignment = useMemo(() => {
    return calculateSmartAxisAssignment(chartData, visibleMaterials);
  }, [chartData, visibleMaterials]);

  // 개선된 Y축 도메인 계산 (눈금 포함)
  const leftAxisConfig = useMemo(() => {
    const [domainMin, domainMax, ticks] = calculateSmartYAxisDomain(chartData, axisAssignment.leftAxisMaterials);
    return { domain: [domainMin, domainMax], ticks };
  }, [chartData, axisAssignment.leftAxisMaterials]);

  const rightAxisConfig = useMemo(() => {
    const [domainMin, domainMax, ticks] = calculateSmartYAxisDomain(chartData, axisAssignment.rightAxisMaterials);
    return { domain: [domainMin, domainMax], ticks };
  }, [chartData, axisAssignment.rightAxisMaterials]);
  
  // 단위 정보 추출 (첫 번째 데이터에서) - 변환된 단위로 표시
  const unit = useMemo(() => {
    if (rawData && rawData.length > 0) {
      const originalUnit = rawData[0].unit || '';
      // 차트 데이터가 kg로 변환되므로 항상 '원/kg' 반환
      return '원/kg';
    }
    return '원/kg';
  }, [rawData]);

  // 범례 높이 계산 (동적 공간 확보)
  const legendHeight = useMemo(() => {
    if (visibleMaterials.length === 0) return 0;
    const leftItems = axisAssignment.leftAxisMaterials.length;
    const rightItems = axisAssignment.rightAxisMaterials.length;
    const maxItems = Math.max(leftItems, rightItems);
    return maxItems * 18 + 8; // 각 아이템당 18px + 최소 패딩 8px
  }, [visibleMaterials, axisAssignment]);

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
        {/* 단위 표시 - 오른쪽 위 */}
        {unit && (
          <div className="absolute top-4 right-6 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded border border-gray-200 z-10">
            단위: {unit}
          </div>
        )}
        
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
                  
                  <YAxis yAxisId="left" stroke="#6b7280" tickFormatter={formatYAxisPrice} fontSize={12} tickLine={false} axisLine={true} tick={{ fill: '#6b7280', fontWeight: 500 }} domain={leftAxisConfig.domain} ticks={leftAxisConfig.ticks} />
                  
                  {/* 우측 Y축을 스마트 배치에 따라 표시 */}
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    stroke="#6b7280" 
                    tickFormatter={formatYAxisPrice} 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={true} 
                    tick={{ fill: '#6b7280', fontWeight: 500 }} 
                    domain={rightAxisConfig.domain}
                    ticks={rightAxisConfig.ticks}
                    hide={axisAssignment.rightAxisMaterials.length === 0} // 우측 축에 표시할 자재가 없을 때만 숨김
                  />

                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '14px', fontWeight: 500 }}
                    labelStyle={{ color: '#374151', fontWeight: 600 }}
                    formatter={(value: number, name: string) => {
                      const formattedPrice = new Intl.NumberFormat('ko-KR').format(value);
                      return [`${formattedPrice}원/kg`, shortenMaterialName(name)];
                    }}
                    labelFormatter={(label) => `기간: ${label}`}
                  />

                  {visibleMaterials.map((material, index) => {
                    // 스마트 배치에 따라 yAxisId 결정
                    const yAxisId = axisAssignment.leftAxisMaterials.includes(material) ? 'left' : 'right';
                    
                    return (
                      <Line
                        key={material}
                        yAxisId={yAxisId}
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
                    );
                  })}
                </LineChart>
               </ResponsiveContainer>
               {visibleMaterials.length > 0 && (
                 <div style={{ marginTop: '8px' }}>
                   <CustomizedLegend 
                     payload={chartData.length > 0 ? visibleMaterials.map((material, index) => ({ 
                       value: material, 
                       color: COLORS[index % COLORS.length], 
                       dataKey: material 
                     })) : []} 
                     visibleMaterials={visibleMaterials}
                     axisAssignment={axisAssignment}
                   />
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