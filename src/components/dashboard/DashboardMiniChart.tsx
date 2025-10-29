/**
 * DashboardMiniChart.tsx - 대시보드 미니 차트 컴포넌트 (v.Final Revised)
 */
'use client';

import React, { useMemo } from 'react';
// [수정] 올바른 경로로 변경
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import useMaterialStore from '@/store/materialStore';
import PriceTable, { MaterialPriceData } from '../materials/PriceTable';
import { formatXAxisLabel } from '@/utils/dateFormatter';
import { materialInfoMap } from '@/config/chartConfig';


/**
 * 자재 가격 데이터를 Redis 캐시 우선으로 가져오는 함수
 */
const fetchPriceData = async (
  materials: string[],
  startDate: string,
  endDate: string,
  interval: 'weekly' | 'monthly' | 'yearly'
) => {
  if (!materials || materials.length === 0) return [];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch('/api/materials/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
      body: JSON.stringify({ materials, startDate, endDate, interval }),
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'API Error' }));
      throw new Error(errorData.message || `API Request Failed: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out.');
    }
    throw error;
  }
};

/**
 * DB 데이터를 Recharts 형태로 변환
 */
const transformDataForChart = (
  data: any[],
  materialsMap: { id: string; displayName: string }[],
  interval: 'weekly' | 'monthly' | 'yearly'
) => {
  if (!data || data.length === 0) return [];

  const displayNameMap = new Map(materialsMap.map(m => [m.id, m.displayName]));
  const visibleMaterials = materialsMap.map(m => m.displayName);

  // 단위 변환 로직을 함수 내부에 정의 - 데이터베이스 단위 정보만 사용
  const shouldConvertUnit = (unit: string) => {
    const unitLower = unit.toLowerCase();
    return unitLower.includes('ton') || unitLower.includes('톤');
  };

  const groupedData = data.reduce((acc, item) => {
    const { time_bucket, specification, average_price, unit } = item;
    const displayName = displayNameMap.get(specification);

    if (!acc[time_bucket]) {
      acc[time_bucket] = { time_bucket };
    }

    if (displayName) {
      const rawPrice = parseFloat(average_price);
      const isLargeUnit = shouldConvertUnit(unit);
      const isSpecialMaterial = specification && specification.toLowerCase().includes('pp봉');
      const convertedPrice = (isLargeUnit && !isSpecialMaterial) ? rawPrice / 1000 : rawPrice;
      acc[time_bucket][displayName] = convertedPrice;
    }
    return acc;
  }, {});

  let resultArray = Object.values(groupedData);
  resultArray = resultArray.map((group: any) => {
    visibleMaterials.forEach(material => {
      if (!(material in group)) {
        group[material] = null;
      }
    });
    return group;
  });

  return resultArray.sort((a, b) => (a as { time_bucket: string }).time_bucket.localeCompare((b as { time_bucket: string }).time_bucket));
};

const COLORS = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const analyzePriceRange = (data: any[], material: string) => {
  if (!data || data.length === 0) return { min: 0, max: 0, range: 0 };
  let min = Infinity, max = -Infinity;
  data.forEach(item => {
    const value = item[material];
    if (value !== null && !isNaN(value)) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  });
  if (min === Infinity || max === -Infinity) return { min: 0, max: 0, range: 0 };
  return { min, max, range: max - min };
};

const calculateSmartYAxisDomain = (data: any[], materials: string[]): [number, number, number[]] => {
    if (!data || data.length === 0) return [0, 1000, [0, 250, 500, 750, 1000]];
    let min = Infinity, max = -Infinity;
    data.forEach(item => {
        materials.forEach(material => {
            const value = item[material];
            if (value !== null && !isNaN(value)) {
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
        });
    });
    if (min === Infinity || max === -Infinity) return [0, 1000, [0, 250, 500, 750, 1000]];
    const range = max - min;
    const targetTickCount = 5;
    const rawInterval = range / (targetTickCount - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
    const niceFractions = [1, 2, 2.5, 5, 10];
    let tickInterval = 10 * magnitude;
    let minError = Infinity;
    for (const fraction of niceFractions) {
        const niceInterval = fraction * magnitude;
        const error = Math.abs(rawInterval - niceInterval);
        if (error < minError) {
            minError = error;
            tickInterval = niceInterval;
        }
    }
    let domainMin, domainMax;
    if (min / max < 0.3) {
        domainMin = 0;
        domainMax = Math.ceil(max / tickInterval) * tickInterval;
        if (domainMax < max + tickInterval * 0.1) domainMax += tickInterval;
    } else {
        const padding = (max - min) * 0.1;
        const paddedMin = min - padding;
        const paddedMax = max + padding;
        const paddedRange = paddedMax - paddedMin;
        const rawPaddedInterval = paddedRange > 0 ? paddedRange / (targetTickCount - 1) : tickInterval;
        const paddedMagnitude = Math.pow(10, Math.floor(Math.log10(rawPaddedInterval)));
        let paddedMinError = Infinity;
        for (const fraction of niceFractions) {
            const niceInterval = fraction * paddedMagnitude;
            const error = Math.abs(rawPaddedInterval - niceInterval);
            if (error < paddedMinError) {
                paddedMinError = error;
                tickInterval = niceInterval;
            }
        }
        domainMin = Math.floor(paddedMin / tickInterval) * tickInterval;
        domainMax = Math.ceil(paddedMax / tickInterval) * tickInterval;
    }
    const newRange = domainMax - domainMin;
    tickInterval = newRange / 4;
    const ticks: number[] = [];
    const factor = 1 / Math.pow(10, Math.max(0, Math.ceil(-Math.log10(tickInterval))));
    let currentTick = Math.round(domainMin * factor) / factor;
    while (currentTick <= domainMax + tickInterval * 0.001) {
        ticks.push(currentTick);
        currentTick = Math.round((currentTick + tickInterval) * factor) / factor;
    }
    if (ticks.length < 2) {
        domainMax += tickInterval;
        ticks.push(domainMax);
    }
    return [domainMin, domainMax, ticks];
};

const calculateYAxisDomain = (data: any[], materials: string[]) => {
    return calculateSmartYAxisDomain(data, materials);
};

// ====================================================================================
// 그룹핑 기반으로 Y축을 스마트하게 분할하는 함수 (개선된 로직)
// ====================================================================================
const calculateSmartAxisAssignment = (data: any[], materials: string[]): {
  leftAxisMaterials: string[];
  rightAxisMaterials: string[];
  leftAxisDomain: [number, number];
  rightAxisDomain: [number, number] | ['auto', 'auto'];
  leftAxisTicks: number[];
  rightAxisTicks: number[];
} => {
    if (!data || data.length === 0 || materials.length === 0) {
        return { leftAxisMaterials: [], rightAxisMaterials: [], leftAxisDomain: [0, 0], rightAxisDomain: [0, 0], leftAxisTicks: [], rightAxisTicks: [] };
    }

    const materialRanges = materials.map(material => ({ material, ...analyzePriceRange(data, material) }))
        .sort((a, b) => b.max - a.max);

    if (materialRanges.length <= 1) {
        const [domainMin, domainMax, ticks] = calculateYAxisDomain(data, materials);
        return { leftAxisMaterials: materials, rightAxisMaterials: [], leftAxisDomain: [domainMin, domainMax], rightAxisDomain: ['auto', 'auto'], leftAxisTicks: ticks, rightAxisTicks: [] };
    }

    const GROUPING_THRESHOLD = 2.5;
    const groups: string[][] = [];
    let currentGroup: string[] = [];

    materialRanges.forEach((item, index) => {
        if (index === 0) {
            currentGroup.push(item.material);
        } else {
            const prevItem = materialRanges[index - 1];
            if (item.max > 0 && prevItem.max / item.max > GROUPING_THRESHOLD) {
                groups.push(currentGroup);
                currentGroup = [item.material];
            } else {
                currentGroup.push(item.material);
            }
        }
    });
    groups.push(currentGroup);

    if (groups.length > 1 && groups[0].length < materials.length) {
        const leftAxisMaterials = groups[0];
        const rightAxisMaterials = groups.slice(1).flat();

        if (rightAxisMaterials.length > 0) {
            const [leftDomainMin, leftDomainMax, leftTicks] = calculateYAxisDomain(data, leftAxisMaterials);
            const [rightDomainMin, rightDomainMax, rightTicks] = calculateYAxisDomain(data, rightAxisMaterials);
            return {
                leftAxisMaterials,
                rightAxisMaterials,
                leftAxisDomain: [leftDomainMin, leftDomainMax],
                rightAxisDomain: [rightDomainMin, rightDomainMax],
                leftAxisTicks: leftTicks,
                rightAxisTicks: rightTicks
            };
        }
    }

    const [domainMin, domainMax, ticks] = calculateYAxisDomain(data, materials);
    return {
        leftAxisMaterials: materials,
        rightAxisMaterials: [],
        leftAxisDomain: [domainMin, domainMax],
        rightAxisDomain: ['auto', 'auto'],
        leftAxisTicks: ticks,
        rightAxisTicks: []
    };
};

const formatYAxisPrice = (value: number) => value.toFixed(1).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,') + '원';
const formatTooltipValue = (value: number, unit?: string) => value.toFixed(1).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,') + (unit ? ` ${unit}` : '');
// 하드코딩된 단위 판별 함수 제거 - 이제 데이터베이스에서 실제 단위를 가져옴
// const isLargeWeightUnit = (unit: string, materialName: string): boolean => {
//   const unitLower = unit?.toLowerCase() || '';
//   if (unitLower.includes('ton') || unitLower.includes('톤') || unitLower === 't') return true;
//   
//   const materialLower = materialName?.toLowerCase() || '';
//   
//   // PVDF는 제외 - 미터 단위로 거래됨
//   if (materialLower.includes('pvdf')) {
//     return false;
//   }
//   
//   const largeMaterialKeywords = ['pp', 'hdpe', 'pvc', 'abs', 'pc', 'pet', 'ps', '플라스틱', '수지'];
//   return largeMaterialKeywords.some(keyword => materialLower.includes(keyword));
// };

interface MaterialInfo {
  id: string;
  displayName: string;
}

interface DashboardMiniChartProps {
  title: string;
  materials: MaterialInfo[];
}

const DashboardMiniChart: React.FC<DashboardMiniChartProps> = ({ title, materials }) => {
  const { interval, startDate, endDate } = useMaterialStore();
  const materialIds = useMemo(() => materials.map(m => m.id), [materials]);

  // 단위 판별 함수 (데이터베이스 단위 정보만 사용)
  const isLargeWeightUnit = (unit: string) => {
    const unitLower = unit.toLowerCase();
    return unitLower.includes('ton') || unitLower.includes('톤');
  };

  const {
    data: rawData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['dashboardChart', materialIds.join(','), startDate, endDate, interval],
    queryFn: () => fetchPriceData(materialIds, startDate, endDate, interval as 'weekly' | 'monthly' | 'yearly'),
    enabled: materialIds.length > 0 && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const chartData = useMemo(() => {
    if (!rawData) return [];
    return transformDataForChart(rawData, materials, interval);
  }, [rawData, materials, interval]);

  const axisAssignment = useMemo(() => {
    return calculateSmartAxisAssignment(chartData, materials.map(m => m.displayName));
  }, [chartData, materials]);

  const tableData: MaterialPriceData[] = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    return materials.map((material) => {
      const materialData = rawData.filter((item: any) => item.specification === material.id);
      if (materialData.length === 0) return { name: material.displayName, currentPrice: 0, unit: '', monthlyChange: null, yearlyChange: null, twoYearAgoChange: null };

      const sortedData = materialData.sort((a: { time_bucket: string }, b: { time_bucket: string }) => new Date(b.time_bucket).getTime() - new Date(a.time_bucket).getTime());
      const rawPrice = parseFloat(sortedData[0]?.average_price || '0');
      
      // 데이터베이스에서 가져온 실제 단위 정보 사용
      const actualUnit = sortedData[0]?.unit || '';
      const isLargeUnit = actualUnit.toLowerCase().includes('ton') || actualUnit.toLowerCase().includes('톤');
      
      let currentPrice = rawPrice;
      let displayUnit = actualUnit;
      
      // 대용량 단위 처리 (ton -> kg 변환)
      if (isLargeUnit) {
        currentPrice = rawPrice / 1000;
        displayUnit = 'kg';
      }

      // 월간 변화율 계산
      let monthlyChange: number | null = null;
      if (sortedData.length >= 2) {
        const previousRawPrice = parseFloat(sortedData[1]?.average_price || '0');
        const previousPrice = isLargeUnit ? previousRawPrice / 1000 : previousRawPrice;
        if (previousPrice !== 0) {
          monthlyChange = ((currentPrice - previousPrice) / previousPrice) * 100;
          monthlyChange = Math.round(monthlyChange * 100) / 100;
        }
      }

      // 연간 변화율 계산
      let yearlyChange: number | null = null;
      const yearAgoIndex = Math.min(12, sortedData.length - 1);
      if (yearAgoIndex > 0) {
        const yearAgoRawPrice = parseFloat(sortedData[yearAgoIndex]?.average_price || '0');
        const yearAgoPrice = isLargeUnit ? yearAgoRawPrice / 1000 : yearAgoRawPrice;
        if (yearAgoPrice !== 0) {
          yearlyChange = ((currentPrice - yearAgoPrice) / yearAgoPrice) * 100;
          yearlyChange = Math.round(yearlyChange * 100) / 100;
        }
      }

      // 2년 전 대비 변화율 계산
      let twoYearAgoChange: number | null = null;
      const twoYearAgoIndex = Math.min(24, sortedData.length - 1);
      if (twoYearAgoIndex > 0) {
        let twoYearAgoRawPrice = parseFloat(sortedData[twoYearAgoIndex]?.average_price || '0');
        if (isNaN(twoYearAgoRawPrice)) twoYearAgoRawPrice = 0;
        const twoYearAgoPrice = isLargeUnit ? twoYearAgoRawPrice / 1000 : twoYearAgoRawPrice;
        if (twoYearAgoPrice !== 0) {
          twoYearAgoChange = ((currentPrice - twoYearAgoPrice) / twoYearAgoPrice) * 100;
          twoYearAgoChange = Math.round(twoYearAgoChange * 100) / 100;
        }
      }

      return { 
        name: material.displayName, 
        currentPrice: Math.round(currentPrice), 
        unit: displayUnit, 
        monthlyChange, 
        yearlyChange, 
        twoYearAgoChange 
      };
    });
  }, [rawData, materials]);

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-md font-semibold flex items-center">
          <div className="flex-grow text-center">{title}</div>
          <span className="text-sm font-normal text-gray-500 ml-auto">
            {tableData.length > 0 ? (tableData.some(item => item.unit !== tableData[0]?.unit) ? '(원)' : `(원/${tableData[0].unit})`) : '(원)'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className="h-48 sm:h-64 w-full relative">
          {isLoading ? <Skeleton className="h-full w-full" />
            : isError ? <div className="flex h-full items-center justify-center text-center text-sm text-red-500">데이터 로딩 실패<br/>({error?.message || '알 수 없는 오류'})</div>
            : !chartData || chartData.length === 0 ? <div className="flex h-full items-center justify-center text-sm text-gray-500">표시할 데이터가 없습니다.</div>
            : (
            <ResponsiveContainer width="100%" height="100%" minHeight={192}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="2 2" strokeOpacity={0.5} vertical={true} />
                <XAxis dataKey="time_bucket" tick={{ fontSize: 10 }} tickFormatter={(value) => formatXAxisLabel(value, interval)} />
                <ReferenceLine x={new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: '-1M', position: 'top', fill: '#94a3b8', fontSize: 10 }} />
                <ReferenceLine x={new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: '-1Y', position: 'top', fill: '#94a3b8', fontSize: 10 }} />
                <YAxis yAxisId="left" orientation="left" width={60} tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={formatYAxisPrice} domain={axisAssignment.leftAxisDomain} ticks={axisAssignment.leftAxisTicks} tickCount={5} axisLine={false} tickLine={false} />
                {axisAssignment.rightAxisMaterials.length > 0 && (
                  <YAxis yAxisId="right" orientation="right" width={60} tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={formatYAxisPrice} domain={axisAssignment.rightAxisDomain} ticks={axisAssignment.rightAxisTicks} tickCount={5} axisLine={false} tickLine={false} />
                )}
                <Tooltip wrapperClassName="text-xs" formatter={(value: number, name: string) => [formatTooltipValue(value), name]} labelFormatter={(label: string) => formatXAxisLabel(label, interval)} />
                <Legend content={() => null} />
                {axisAssignment.leftAxisMaterials.map((materialName) => {
                  const material = materials.find(m => m.displayName === materialName);
                  if (!material) return null;
                  return <Line key={material.id} yAxisId="left" type="monotone" dataKey={material.displayName} name={material.displayName} stroke={COLORS[materials.findIndex(m => m.displayName === materialName) % COLORS.length]} strokeWidth={2} dot={{ r: 1.5 }} activeDot={{ r: 3 }} connectNulls />;
                })}
                {axisAssignment.rightAxisMaterials.map((materialName) => {
                  const material = materials.find(m => m.displayName === materialName);
                  if (!material) return null;
                  return <Line key={material.id} yAxisId="right" type="monotone" dataKey={material.displayName} name={material.displayName} stroke={COLORS[materials.findIndex(m => m.displayName === materialName) % COLORS.length]} strokeWidth={2} dot={{ r: 1.5 }} activeDot={{ r: 3 }} connectNulls />;
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        
        {/* --- 최종 수정된 커스텀 범례 (유연한 Flexbox 적용) --- */}
        {materials.length > 0 && !isLoading && (
          <div className="mt-2 px-2 flex justify-between items-start gap-4">
            {/* 왼쪽 (주축) 범례 */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-start">
              {axisAssignment.leftAxisMaterials.map((displayName) => {
                const material = materials.find(m => m.displayName === displayName);
                if (!material) return null;
                const info = materialInfoMap.get(material.id);
                const summaryName = info?.summaryName || displayName;
                const materialIndex = materials.indexOf(material);
                return (
                  <div key={`legend-left-${material.id}`} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: COLORS[materialIndex % COLORS.length] }} />
                    <span className="text-xs text-gray-700 leading-tight truncate" title={displayName}>{summaryName}</span>
                  </div>
                );
              })}
            </div>

            {/* 오른쪽 (보조축) 범례 */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-end">
              {axisAssignment.rightAxisMaterials.map((displayName) => {
                const material = materials.find(m => m.displayName === displayName);
                if (!material) return null;
                const info = materialInfoMap.get(material.id);
                const summaryName = info?.summaryName || displayName;
                const materialIndex = materials.indexOf(material);
                return (
                  <div key={`legend-right-${material.id}`} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: COLORS[materialIndex % COLORS.length] }} />
                    <span className="text-xs text-gray-700 leading-tight truncate" title={displayName}>{summaryName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        <div className="mt-3">
          <PriceTable data={tableData} isLoading={isLoading} />
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardMiniChart;