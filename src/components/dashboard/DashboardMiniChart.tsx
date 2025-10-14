/**
 * DashboardMiniChart.tsx - 대시보드 미니 차트 컴포넌트
 * 
 * 기능:
 * - 선택된 자재들의 가격 변화를 라인 차트로 시각화
 * - 주축/보조축 구조로 가격 범위가 다른 자재들을 명확하게 표시
 * - React Query를 사용한 데이터 캐싱 및 상태 관리
 * - Zustand 스토어와 연동하여 날짜/기간 설정 공유
 * - 로딩/에러 상태 처리 및 스켈레톤 UI 제공
 * 
 * 연관 파일:
 * - src/components/dashboard/DashboardChartGrid.tsx (부모 컴포넌트)
 * - src/store/materialStore.ts (날짜/기간 설정 공유)
 * - src/utils/supabase/client.ts (데이터베이스 연동)
 * - src/components/ui/card.tsx, skeleton.tsx (UI 컴포넌트)
 * 
 * 중요도: ⭐⭐⭐ 필수 - 대시보드의 핵심 차트 기능
 * 
 * 데이터베이스 의존성:
 * - get_price_data RPC 함수 (Supabase)
 * - material_prices 테이블
 */
'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import useMaterialStore from '@/store/materialStore';
import PriceTable, { MaterialPriceData } from '../materials/PriceTable';
import { formatXAxisLabel } from '@/utils/dateFormatter';
// convertToKgUnit 및 calculatePriceChange import 제거



/**
 * 자재 가격 데이터를 Redis 캐시 우선으로 가져오는 함수
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

  // 타임아웃 설정 (25초)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch('/api/materials/prices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      signal: controller.signal,
      body: JSON.stringify({ materials, startDate, endDate, interval }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: '알 수 없는 API 오류' }));
      throw new Error(errorData.message || `API 요청 실패: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('fetchPriceData 응답:', { materials, result });
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }
    throw error;
  }
};

/**
 * 주간 번호 계산 함수 (MaterialsChart.tsx에서 가져옴)
 */
const getWeekNumber = (year: number, month: number, weekOfMonth: number): number => {
  const firstDayOfMonth = new Date(year, month, 1);
  
  // 해당 월의 첫 번째 주의 시작일 계산
  const firstMondayOfMonth = new Date(firstDayOfMonth);
  const dayOfWeek = firstDayOfMonth.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  firstMondayOfMonth.setDate(firstDayOfMonth.getDate() + daysToMonday);
  
  // 해당 주차의 월요일 날짜 계산
  const targetMonday = new Date(firstMondayOfMonth);
  targetMonday.setDate(firstMondayOfMonth.getDate() + (weekOfMonth - 1) * 7);
  
  // ISO 주간 번호 계산
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const firstMondayOfYear = new Date(jan4.getTime() - (jan4Day - 1) * 24 * 60 * 60 * 1000);
  
  const weekNumber = Math.floor((targetMonday.getTime() - firstMondayOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  
  return Math.max(1, Math.min(53, weekNumber));
};

/**
 * DB에서 받은 데이터를 Recharts가 사용할 수 있는 형태로 변환합니다.
 * DB의 긴 specification 이름을 UI에 표시될 displayName으로 매핑합니다.
 * @param data - Supabase RPC로부터 받은 원본 데이터 배열
 * @param materialsMap - {id, displayName} 객체 배열
 * @param interval - 데이터 집계 간격 (주간/월간/연간)
 * @returns Recharts에 적합한 데이터 배열
 */
const transformDataForChart = (
  data: any[],
  materialsMap: { id: string; displayName: string }[],
  interval: 'weekly' | 'monthly' | 'yearly'
) => {
  if (!data || data.length === 0) return [];

  // id(긴 이름)를 displayName(짧은 이름)으로 빠르게 찾기 위한 맵 생성
  const displayNameMap = new Map(materialsMap.map(m => [m.id, m.displayName]));
  const visibleMaterials = materialsMap.map(m => m.displayName);

  const groupedData = data.reduce((acc, item) => {
    const { time_bucket, specification, average_price, unit } = item;

    // 현재 데이터의 긴 이름(specification)을 짧은 이름(displayName)으로 변환
    const displayName = displayNameMap.get(specification);

    // time_bucket을 기준으로 객체를 생성하거나 기존 객체를 사용
    if (!acc[time_bucket]) {
      acc[time_bucket] = { time_bucket };
    }

    // 짧은 이름을 key로 사용하여 평균 가격 데이터를 저장
    if (displayName) {
      const rawPrice = parseFloat(average_price);
      
      // 톤 단위 감지 및 변환 (자재명도 고려)
      const isLargeUnit = isLargeWeightUnit(unit, specification);
      
      // PP봉만 특별히 톤 단위 유지
      const isSpecialMaterial = specification && (
        specification.toLowerCase().includes('pp봉')
      );
      
      // 디버깅 로그 (PP, HDPE 자재의 경우)
      if (specification && (specification.includes('PP') || specification.includes('HDPE'))) {
        console.log(`차트 ${specification} 자재 변환: 원본가격: ${rawPrice}, 단위: ${unit}, 톤단위인가: ${isLargeUnit}, 특별자재: ${isSpecialMaterial}, 변환후: ${(isLargeUnit && !isSpecialMaterial) ? rawPrice / 1000 : rawPrice}`);
      }
      
      const convertedPrice = (isLargeUnit && !isSpecialMaterial) ? rawPrice / 1000 : rawPrice;
      acc[time_bucket][displayName] = convertedPrice;
    }

    return acc;
  }, {});

  // Object.values() 결과를 명시적으로 배열로 변환
  let resultArray = Object.values(groupedData);
  
  // 주간 모드에서 더 조밀한 데이터 포인트 생성
  if (interval === 'weekly' && resultArray.length > 0) {
    const expandedData: any[] = [];
    
    // 날짜순으로 정렬
    const sortedData = resultArray.sort((a: any, b: any) => a.time_bucket.localeCompare(b.time_bucket));
    
    for (let i = 0; i < sortedData.length; i++) {
      const currentData = sortedData[i];
      const currentDate = new Date((currentData as { time_bucket: string }).time_bucket);
      
      // 현재 월의 주차별 데이터 생성 (4-5개 주차)
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      // 해당 월의 첫 번째 날과 마지막 날
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      // 해당 월의 주차 수 계산 (대략 4-5주)
      const weeksInMonth = Math.ceil((lastDay.getDate() + firstDay.getDay()) / 7);
      
      // 각 주차별 데이터 생성
      for (let week = 1; week <= weeksInMonth; week++) {
        const weekData: any = {};
        
        // ISO 주간 형식으로 time_bucket 생성 (예: "2024-W05")
        const weekNumber = getWeekNumber(year, month, week);
        weekData.time_bucket = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
        
        // 모든 자재에 대해 동일한 가격 데이터 복사
        visibleMaterials.forEach(material => {
          if ((currentData as Record<string, number>)[material] !== undefined) {
            weekData[material] = (currentData as Record<string, number>)[material];
          } else {
            weekData[material] = null;
          }
        });
        
        expandedData.push(weekData);
      }
    }
    
    resultArray = expandedData;
  } else {
    // 모든 자재에 대해 null 값 채우기 (월간/연간 모드)
    resultArray = resultArray.map((group: any) => {
      visibleMaterials.forEach(material => {
        if (!(material in group)) {
          group[material] = null; // 데이터 없는 부분은 null로 채워 'connectNulls'가 잘 동작하도록 함
        }
      });
      return group;
    });
  }
  
  // 날짜순으로 정렬
  const sortedResult = resultArray.sort((a, b) => (a as { time_bucket: string }).time_bucket.localeCompare((b as { time_bucket: string }).time_bucket));
  
  return sortedResult;
};

// 차트 라인 색상 팔레트 (최대 8개 자재까지 지원)
const COLORS = [
  '#6366f1', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

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
  leftAxisTicks: number[];
  rightAxisTicks: number[];
} => {
  if (!data || data.length === 0 || materials.length === 0) {
    return {
      leftAxisMaterials: [],
      rightAxisMaterials: [],
      leftAxisDomain: ['dataMin - 100', 'dataMax + 100'],
      rightAxisDomain: ['dataMin - 100', 'dataMax + 100'],
      leftAxisTicks: [0, 250, 500, 750, 1000],
      rightAxisTicks: [0, 250, 500, 750, 1000]
    };
  }

  // 각 자재의 가격 범위 분석
  const materialRanges = materials.map(material => ({
    material,
    ...analyzePriceRange(data, material)
  }));

  // 가격 수준에 따른 자재 분류 (5000원 기준)
  const highPriceMaterials: string[] = [];
  const lowPriceMaterials: string[] = [];

  materialRanges.forEach(({ material, max }) => {
    if (max >= 5000) {
      highPriceMaterials.push(material);
    } else {
      lowPriceMaterials.push(material);
    }
  });

  let leftAxisMaterials: string[] = [];
  let rightAxisMaterials: string[] = [];

  // 고가 자재가 있으면 주축(좌측)에, 저가 자재는 보조축(우측)에 배치
  if (highPriceMaterials.length > 0 && lowPriceMaterials.length > 0) {
    leftAxisMaterials = [...highPriceMaterials];
    rightAxisMaterials = [...lowPriceMaterials];
  } else {
    // 모든 자재가 한 그룹에 속할 경우, 모든 자재를 주축에 표시
    leftAxisMaterials = materials;
    rightAxisMaterials = [];
  }
  
  // 만약 모든 자재가 5000원 미만인데, 가격 편차가 클 경우 축을 분리
  if (highPriceMaterials.length === 0 && lowPriceMaterials.length > 1) {
      const sortedByMax = materialRanges.sort((a, b) => b.max - a.max);
      const maxPrice = sortedByMax[0].max;
      const minPrice = sortedByMax[sortedByMax.length - 1].max;

      if (maxPrice / minPrice > 5) { // 5배 이상 차이나면 분리
          const mainMaterial = sortedByMax[0].material;
          leftAxisMaterials = [mainMaterial];
          rightAxisMaterials = materials.filter(m => m !== mainMaterial);
      }
  }


  // 각 축의 도메인 계산
  const [leftDomainMin, leftDomainMax, leftTicks] = calculateYAxisDomain(data, leftAxisMaterials, false);
  const [rightDomainMin, rightDomainMax, rightTicks] = rightAxisMaterials.length > 0 
    ? calculateYAxisDomain(data, rightAxisMaterials, true)
    : [0, 1000, [0, 250, 500, 750, 1000]];

  return {
    leftAxisMaterials,
    rightAxisMaterials,
    leftAxisDomain: [leftDomainMin, leftDomainMax],
    rightAxisDomain: rightAxisMaterials.length > 0 ? [rightDomainMin, rightDomainMax] : ['auto', 'auto'],
    leftAxisTicks: Array.isArray(leftTicks) ? leftTicks : [leftTicks],
    rightAxisTicks: rightAxisMaterials.length > 0 ? (Array.isArray(rightTicks) ? rightTicks : [rightTicks]) : []
  };
};

// Y축 눈금 간격을 계산하는 함수 (삭제됨, calculateSmartYAxisDomain으로 통합)

// 명확한 기준으로 Y축 도메인과 눈금을 계산하는 함수
const calculateSmartYAxisDomain = (data: any[], materials: string[], isSecondaryAxis: boolean = false): [number, number, number[]] => {
  if (!data || data.length === 0) {
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

  // 새로운 Y축 계산 로직
  const range = max - min;
  
  // 1. "Nice" 간격 계산
  const targetTickCount = 5;
  const rawInterval = range / (targetTickCount - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
  const niceFractions = [1, 2, 2.5, 5, 10];
  let tickInterval = 10 * magnitude; // 기본값

  let minError = Infinity;
  for (const fraction of niceFractions) {
      const niceInterval = fraction * magnitude;
      const error = Math.abs(rawInterval - niceInterval);
      if (error < minError) {
          minError = error;
          tickInterval = niceInterval;
      }
  }

  // 2. Y축 범위 결정
  let domainMin: number;
  let domainMax: number;

  // 데이터 변동폭이 크면 0부터 시작
  if (min / max < 0.3) {
      domainMin = 0;
      domainMax = Math.ceil(max / tickInterval) * tickInterval;
      // 만약 domainMax가 max를 겨우 포함하는 수준이면 한 단계 위로 올림 (더 엄격한 조건)
      if (domainMax < max + tickInterval * 0.1) {
          domainMax += tickInterval;
      }
  } else {
      // 데이터 변동폭이 좁을 경우, min/max에 여백을 추가하여 범위를 재설정
      const padding = (max - min) * 0.1; // 상하단에 10%씩 여백 추가
      const paddedMin = min - padding;
      const paddedMax = max + padding;
      const paddedRange = paddedMax - paddedMin;

      // 여백이 적용된 범위에 맞춰 다시 "Nice" 간격 계산
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
  
  // 4개의 균등한 간격으로 재계산
  const newRange = domainMax - domainMin;
  tickInterval = newRange / 4;

  // 3. Ticks 생성 (동적)
  const ticks: number[] = [];
  // 부동소수점 오류를 피하기 위해 정수 연산 시도
  const factor = 1 / Math.pow(10, Math.max(0, Math.ceil(-Math.log10(tickInterval))));
  let currentTick = Math.round(domainMin * factor) / factor;

  while (currentTick <= domainMax + tickInterval * 0.001) { // 부동소수점 오차 감안
    ticks.push(currentTick);
    currentTick = Math.round((currentTick + tickInterval) * factor) / factor;
  }

  // 눈금이 하나만 생성되는 경우 (min, max가 거의 같을 때) domainMax를 강제로 한단계 올림
  if (ticks.length < 2) {
      domainMax += tickInterval;
      ticks.push(domainMax);
  }

  return [domainMin, domainMax, ticks];
};

// Y축 도메인 계산 함수 (패딩 포함)
const calculateYAxisDomain = (data: any[], materials: string[], isSecondaryAxis: boolean = false) => {
  const [domainMin, domainMax, ticks] = calculateSmartYAxisDomain(data, materials, isSecondaryAxis);
  return [domainMin, domainMax, ticks];
};

// Y축 가격 포맷팅 함수 - 소수점 첫째자리까지 표시
const formatYAxisPrice = (value: number) => {
  // 소수점 첫째 자리까지 표시
  const formattedValue = value.toFixed(1);
  return `${formattedValue.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')}원`;
};

// 툴팁 포맷팅 함수 - 소수점 첫째자리까지 표시
const formatTooltipValue = (value: number, unit?: string): string => {
  const formattedValue = value.toFixed(1);
  return `${formattedValue.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')}${unit ? ` ${unit}` : ''}`;
};

// 톤 단위 감지 함수 - 단위와 자재명을 모두 고려
const isLargeWeightUnit = (unit: string, materialName: string): boolean => {
  if (!unit && !materialName) return false;
  
  // 단위 기반 판별
  const unitLower = unit?.toLowerCase() || '';
  if (unitLower.includes('ton') || unitLower.includes('톤') || unitLower === 't') {
    return true;
  }
  
  // 자재명 기반 판별 (특정 자재들은 톤 단위로 거래되는 경우가 많음)
  const materialLower = materialName?.toLowerCase() || '';
  const largeMaterialKeywords = [
    'pp', 'hdpe', 'ldpe', 'pvc', 'abs', 'pc', 'pa', 'pom', 'pet', 'ps',
    '플라스틱', '수지', '펠릿', '원료', '화학', '석유화학'
  ];
  
  return largeMaterialKeywords.some(keyword => materialLower.includes(keyword));
};

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
  console.log(`[${title}] 컴포넌트 렌더링 시작`);
  
  // useEffect 테스트를 위한 간단한 로그
  console.log(`🚀 [${title}] 컴포넌트 함수 실행 중 - useEffect 전`);
  
  // Zustand 스토어에서 공통 날짜/기간 설정을 가져옴
  const { interval, startDate, endDate } = useMaterialStore();
  
  console.log(`[${title}] 컴포넌트 렌더링:`, { 
    materialIds: materials.map(m => m.id), 
    startDate, 
    endDate, 
    interval,
    enabled: materials.length > 0 && !!startDate && !!endDate
  });

  console.log(`[${title}] useEffect 의존성 배열:`, [materials.map(m => m.id).join(','), startDate, endDate, interval, title]);

  // DB에 쿼리할 실제 ID(긴 이름) 목록을 props로부터 추출
  const materialIds = useMemo(() => materials.map(m => m.id), [materials]);
  
  // Query key를 안정화
  const queryKey = useMemo(() => 
    ['dashboardChart', materialIds.join(','), startDate, endDate, interval], 
    [materialIds, startDate, endDate, interval]
  );

  // React Query를 사용하여 데이터 페칭

  // 임시로 useEffect를 사용하여 직접 데이터 페칭
  const [rawData, setRawData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    console.log(`🔥 [${title}] useEffect 실행됨 - 시작:`, { 
      materialIds, 
      materialIdsLength: materialIds.length,
      startDate, 
      endDate, 
      interval,
      hasStartDate: !!startDate,
      hasEndDate: !!endDate,
      timestamp: new Date().toISOString()
    });

    const fetchData = async () => {
      if (materialIds.length === 0 || !startDate || !endDate) {
        console.log(`[${title}] 조건 불만족으로 데이터 페칭 건너뜀:`, {
          materialIdsLength: materialIds.length,
          hasStartDate: !!startDate,
          hasEndDate: !!endDate
        });
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setIsError(false);
        setError(null);
        
        console.log(`[${title}] fetchPriceData 호출 시작:`, { materialIds, startDate, endDate, interval });
        const result = await fetchPriceData(materialIds, startDate, endDate, interval);
        console.log(`[${title}] fetchPriceData 결과:`, result);
        
        setRawData(result);
      } catch (err) {
        console.error(`[${title}] fetchPriceData 오류:`, err);
        setIsError(true);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [materialIds, startDate, endDate, interval, title]);

  console.log(`✅ [${title}] useEffect 정의 완료 - 다음은 useMemo`);

  // DB에서 받아온 데이터를 차트용으로 가공
  const chartData = useMemo(() => {
    // rawData가 undefined이거나 null인 경우 안전하게 처리
    if (!rawData) {
      console.log(`DashboardMiniChart [${title}]: rawData가 undefined 또는 null입니다.`);
      console.log(`  - Materials:`, materials.map(m => m.id));
      console.log(`  - isLoading:`, isLoading);
      console.log(`  - isError:`, isError);
      console.log(`  - error:`, error);
      console.log(`  - rawData:`, rawData);
      return [];
    }
    console.log(`DashboardMiniChart [${title}]: rawData 정상 수신, 길이:`, rawData.length);
    return transformDataForChart(rawData, materials, interval);
  }, [rawData, materials, interval, title, isLoading, isError, error]);

  // 스마트 축 배치 계산
  const axisAssignment = useMemo(() => {
    return calculateSmartAxisAssignment(chartData, materials.map(m => m.displayName));
  }, [chartData, materials]);

  // 테이블용 데이터 변환 (단위 변환 로직 제거)
  const tableData: MaterialPriceData[] = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    return materials.map((material) => {
      const materialData = rawData.filter((item: any) => item.specification === material.id);
      
      if (materialData.length === 0) {
        return {
          name: material.displayName,
          currentPrice: 0,
          unit: '', // 기본 단위 하드코딩 제거
          monthlyChange: null, // null로 초기화하여 '-' 표시
          yearlyChange: null,  // null로 초기화하여 '-' 표시
          twoYearAgoChange: null, // null로 초기화하여 '-' 표시
        };
      }

      // 날짜순 정렬 (최신순)
      const sortedData = materialData.sort((a: { time_bucket: string }, b: { time_bucket: string }) => new Date(b.time_bucket).getTime() - new Date(a.time_bucket).getTime());
      
      const rawPrice = parseFloat(sortedData[0]?.average_price || '0');
      // 실제 단위 정보 사용
      const actualUnit = sortedData[0]?.unit || '';
      
      // 톤 단위 감지 및 변환 (자재명도 고려)
      const isLargeUnit = isLargeWeightUnit(actualUnit, material.id);
      
      // 디버깅 로그 (PP, HDPE, 시멘트 자재의 경우)
      if (material.displayName.includes('PP') || material.displayName.includes('HDPE') || material.displayName.includes('시멘트')) {
        console.log(`테이블 ${material.displayName} 자재 변환: ${material.displayName} (${material.id}) - 원본가격: ${rawPrice}, 단위: ${actualUnit}, 톤단위인가: ${isLargeUnit}`);
        console.log(`테이블 ${material.displayName} 데이터 개수: ${sortedData.length}, 첫번째 데이터:`, sortedData[0]);
        if (sortedData.length >= 2) {
          console.log(`테이블 ${material.displayName} 두번째 데이터:`, sortedData[1]);
        }
      }
      
      let currentPrice = rawPrice;
      let displayUnit = actualUnit;
      
      // PP봉만 특별히 톤 단위 유지
      const isSpecialMaterial = material.id.toLowerCase().includes('pp봉');
      
      if (isLargeUnit && !isSpecialMaterial) {
        currentPrice = rawPrice / 1000; // 톤을 kg으로 변환 시 가격을 1/1000로 변환
        displayUnit = 'kg';
      } else if (isSpecialMaterial) {
        // PP봉만 톤 단위 유지
        displayUnit = actualUnit || 'ton';
      }
      
      // 전월비 계산 (변환된 가격으로 계산)
      let monthlyChange: number | null = null;
      if (sortedData.length >= 2) {
        const previousRawPrice = parseFloat(sortedData[1]?.average_price || '0');
        // 톤 단위인 경우 이전 가격도 변환 (특별 자재 제외)
        const previousPrice = (isLargeUnit && !isSpecialMaterial) ? previousRawPrice / 1000 : previousRawPrice;
        
        // 시멘트 자재의 경우 전월비 계산 과정 로깅
        if (material.displayName.includes('시멘트')) {
          console.log(`시멘트 전월비 계산: 현재가격=${currentPrice}, 이전가격=${previousPrice}, 이전원본가격=${previousRawPrice}`);
        }
        
        if (previousPrice !== 0) {
          monthlyChange = ((currentPrice - previousPrice) / previousPrice) * 100;
          monthlyChange = Math.round(monthlyChange * 100) / 100;
          
          // 시멘트 자재의 경우 계산 결과 로깅
          if (material.displayName.includes('시멘트')) {
            console.log(`시멘트 전월비 계산 결과: ${monthlyChange}%`);
          }
        } else {
          monthlyChange = null; // 0 대신 null로 설정하여 '-' 표시
          if (material.displayName.includes('시멘트')) {
            console.log(`시멘트 전월비: 이전 가격이 0이므로 null 설정`);
          }
        }
      }

      // 전년비 계산 (변환된 가격으로 계산)
      let yearlyChange: number | null = null;
      const yearAgoIndex = Math.min(12, sortedData.length - 1);
      if (yearAgoIndex > 0) {
        const yearAgoRawPrice = parseFloat(sortedData[yearAgoIndex]?.average_price || '0');
        // 톤 단위인 경우 전년 가격도 변환 (특별 자재 제외)
        const yearAgoPrice = (isLargeUnit && !isSpecialMaterial) ? yearAgoRawPrice / 1000 : yearAgoRawPrice;
        
        if (yearAgoPrice !== 0) {
          yearlyChange = ((currentPrice - yearAgoPrice) / yearAgoPrice) * 100;
          yearlyChange = Math.round(yearlyChange * 100) / 100;
        } else {
          yearlyChange = null; // 0 대신 null로 설정하여 '-' 표시
        }
      }

      // 2년전비 계산 (변환된 가격으로 계산)
      let twoYearAgoChange: number | null = null; // Initialize to null for '-' display
      const twoYearAgoIndex = Math.min(24, sortedData.length - 1);
      if (twoYearAgoIndex > 0) {
        let twoYearAgoRawPrice = parseFloat(sortedData[twoYearAgoIndex]?.average_price || '0');
        if (isNaN(twoYearAgoRawPrice)) twoYearAgoRawPrice = 0; // NaN 처리
        // 톤 단위인 경우 2년전 가격도 변환 (특별 자재 제외)
        const twoYearAgoPrice = (isLargeUnit && !isSpecialMaterial) ? twoYearAgoRawPrice / 1000 : twoYearAgoRawPrice;
        
        // 2년전 가격이 0이 아니면 변동률 계산, 0이면 null로 설정하여 '-' 표시
        if (twoYearAgoPrice !== 0) {
          twoYearAgoChange = ((currentPrice - twoYearAgoPrice) / twoYearAgoPrice) * 100;
          twoYearAgoChange = Math.round(twoYearAgoChange * 100) / 100;
        } else {
          twoYearAgoChange = null; // 0 대신 null로 설정하여 '-' 표시
        }
      }

      return {
        name: material.displayName,
        currentPrice: Math.round(currentPrice), // 소수점 없이 반올림
        unit: displayUnit,
        monthlyChange,
        yearlyChange,
        twoYearAgoChange,
      };
    });
  }, [rawData, materials]);

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-md font-semibold flex items-center">
          <div className="flex-grow text-center">{title}</div>
          <span className="text-sm font-normal text-gray-500 ml-auto">
            {/* 혼합 단위 사용 시 일반적인 단위 표시 */}
            {tableData.length > 0 ? (
              tableData.some(item => item.unit !== tableData[0]?.unit) 
                ? '(원)' // 다른 단위가 섞여 있으면 단위 생략
                : `(원/${tableData[0].unit})` // 모두 같은 단위면 표시
            ) : '(원)'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className="h-48 sm:h-64 w-full relative">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : isError ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-red-500">
              데이터 로딩 실패<br/>({error?.message || error?.toString() || '알 수 없는 오류'})
            </div>
          ) : !chartData || chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              표시할 데이터가 없습니다.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="2 2" strokeOpacity={0.5} vertical={true} />
                <XAxis 
                  dataKey="time_bucket" 
                  tick={{ fontSize: 10 }} 
                  tickFormatter={(value) => formatXAxisLabel(value, interval)}
                />

                {/* 시간 기준선 */}
                {chartData.length > 0 && (
                  <>
                    <ReferenceLine
                      x={new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]}
                      stroke="#94a3b8"
                      strokeDasharray="3 3"
                      label={{ value: '-1M', position: 'top', fill: '#94a3b8', fontSize: 10 }}
                    />
                    <ReferenceLine
                      x={new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]}
                      stroke="#94a3b8"
                      strokeDasharray="3 3"
                      label={{ value: '-1Y', position: 'top', fill: '#94a3b8', fontSize: 10 }}
                    />
                    <ReferenceLine
                      x={new Date(new Date().setFullYear(new Date().getFullYear() - 2)).toISOString().split('T')[0]}
                      stroke="#94a3b8"
                      strokeDasharray="3 3"
                      label={{ value: '-2Y', position: 'top', fill: '#94a3b8', fontSize: 10 }}
                    />
                    <ReferenceLine
                      x={new Date(new Date().setFullYear(new Date().getFullYear() - 3)).toISOString().split('T')[0]}
                      stroke="#94a3b8"
                      strokeDasharray="3 3"
                      label={{ value: '-3Y', position: 'top', fill: '#94a3b8', fontSize: 10 }}
                    />
                  </>
                )}
                
                {/* 주축 (좌측) */}
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  width={60}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickFormatter={formatYAxisPrice}
                  domain={axisAssignment.leftAxisDomain}
                  ticks={axisAssignment.leftAxisTicks}
                  tickCount={5}
                  axisLine={false}
                  tickLine={false}
                />
                
                {/* 보조축 (우측) - 우축 자재가 있을 때만 표시 */}
                {axisAssignment.rightAxisMaterials.length > 0 && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    width={60}
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    tickFormatter={formatYAxisPrice}
                    domain={axisAssignment.rightAxisDomain}
                    ticks={axisAssignment.rightAxisTicks}
                    tickCount={5}
                    axisLine={false}
                    tickLine={false}
                  />
                )}
                
                <Tooltip
                  wrapperClassName="text-xs"
                  formatter={(value: number, name: string) => {
                    return [formatTooltipValue(value), name];
                  }}
                  labelFormatter={(label: string) => {
                    return formatXAxisLabel(label, interval);
                  }}
                />
                
                {/* 기본 범례는 숨김 */}
                <Legend content={() => null} />
                
                {/* 주축 자재들 */}
                {axisAssignment.leftAxisMaterials.map((materialName, index) => {
                  const material = materials.find(m => m.displayName === materialName);
                  if (!material) return null;
                  return (
                    <Line
                      key={material.id}
                      yAxisId="left"
                      type="monotone"
                      dataKey={material.displayName}
                      name={material.displayName}
                      stroke={COLORS[materials.findIndex(m => m.displayName === materialName) % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 1.5, strokeWidth: 1, fill: COLORS[materials.findIndex(m => m.displayName === materialName) % COLORS.length] }}
                      activeDot={{ r: 3, strokeWidth: 1 }}
                      connectNulls
                    />
                  );
                })}
                
                {/* 보조축 자재들 */}
                {axisAssignment.rightAxisMaterials.map((materialName, index) => {
                  const material = materials.find(m => m.displayName === materialName);
                  if (!material) return null;
                  return (
                    <Line
                      key={material.id}
                      yAxisId="right"
                      type="monotone"
                      dataKey={material.displayName}
                      name={material.displayName}
                      stroke={COLORS[materials.findIndex(m => m.displayName === materialName) % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 1.5, strokeWidth: 1, fill: COLORS[materials.findIndex(m => m.displayName === materialName) % COLORS.length] }}
                      activeDot={{ r: 3, strokeWidth: 1 }}
                      connectNulls
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        
        {/* 커스텀 범례 - 좌우 분리 배치 */}
         {materials.length > 0 && (
           <div className="mt-1 flex justify-between items-start">
             {/* 좌측 범례 (주축) */}
             <div className="flex-1">
               {axisAssignment.leftAxisMaterials.length > 0 && (
                 <div className="flex flex-wrap gap-1 sm:gap-2">
                   {axisAssignment.leftAxisMaterials.map((materialName) => {
                     const materialIndex = materials.findIndex(m => m.displayName === materialName);
                     return (
                       <div key={materialName} className="flex items-center gap-1 min-w-0 flex-shrink">
                         <div 
                           className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded flex-shrink-0"
                           style={{ backgroundColor: COLORS[materialIndex % COLORS.length] }}
                         />
                         <span className="text-[10px] sm:text-xs text-gray-700 leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-[60px] sm:max-w-none">
                           {materialName}
                         </span>
                       </div>
                     );
                   })}
                 </div>
               )}
             </div>
             
             {/* 우측 범례 (보조축) */}
             <div className="flex-1 flex justify-end">
               {axisAssignment.rightAxisMaterials.length > 0 && (
                 <div className="flex gap-1 sm:gap-2 justify-end overflow-hidden">
                   {axisAssignment.rightAxisMaterials.map((materialName) => {
                     const materialIndex = materials.findIndex(m => m.displayName === materialName);
                     return (
                       <div key={materialName} className="flex items-center gap-1 min-w-0 flex-shrink">
                         <div 
                           className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded flex-shrink-0"
                           style={{ backgroundColor: COLORS[materialIndex % COLORS.length] }}
                         />
                         <span className="text-[10px] sm:text-xs text-gray-700 leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-[60px] sm:max-w-none">
                           {materialName}
                         </span>
                       </div>
                     );
                   })}
                 </div>
               )}
             </div>
           </div>
        )}
        
        {/* 가격 정보 테이블 */}
        <div className="mt-3">
          <PriceTable data={tableData} isLoading={isLoading} />
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardMiniChart;
