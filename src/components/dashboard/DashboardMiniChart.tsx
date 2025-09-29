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
import { supabase } from '../../../lib/supabaseClient';
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
import PriceTable, { MaterialPriceData } from './PriceTable';
import { formatXAxisLabel } from '@/utils/dateFormatter';
// convertToKgUnit 및 calculatePriceChange import 제거

// Supabase 클라이언트는 lib/supabaseClient.ts에서 import

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
  console.log('fetchPriceData called with:', { materials, startDate, endDate, interval }); // Modified log
  if (!materials || materials.length === 0) return [];
  
  // Redis 캐시에서 먼저 조회
  const { getMaterialDataFromCache, setMaterialDataToCache } = await import('../../lib/redis-cache');
  
  const cachedData = await getMaterialDataFromCache(
    materials, startDate, endDate, interval
  );
  
  if (cachedData) {
    console.log('캐시에서 자재 데이터 조회 성공');
    return cachedData;
  }
  
  console.log('캐시 MISS - Supabase에서 자재 데이터 조회'); // Added log
  
  // 자재별로 개별 RPC 호출하여 타임아웃 방지
  const allData: any[] = [];
  
  for (const material of materials) {
    try {
      console.log(`자재 ${material}에 대한 RPC 호출 시작`);
      
      const { data, error } = await supabase.rpc('get_price_data', {
        p_interval: interval,
        p_start_date: startDate,
        p_end_date: endDate,
        p_major_categories: null,
        p_middle_categories: null,
        p_sub_categories: null,
        p_specifications: [material], // 단일 자재로 호출
        p_spec_names: null,
      });

      if (error) {
        console.error(`자재 ${material} RPC 오류:`, error);
        throw new Error(`자재 ${material} 데이터 조회 실패: ${error?.message || error?.toString() || '알 수 없는 오류'}`);
      }

      if (data && data.length > 0) {
        allData.push(...data);
        console.log(`자재 ${material}: ${data.length}개 데이터 조회 완료`);
      } else {
        console.warn(`자재 ${material}: 데이터 없음`);
      }
    } catch (materialError) {
      console.error(`자재 ${material} 처리 중 오류:`, materialError);
      // 개별 자재 오류는 전체 실패로 이어지지 않도록 처리
      continue;
    }
  }
  
  console.log(`총 ${allData.length}개 데이터 조회 완료`);
  
  // 데이터 처리 - RPC 반환 구조에 맞게 수정 (time_bucket, average_price 필드 사용)
  const processedData = allData.map((item: any) => ({
    time_bucket: item.time_bucket,      // RPC에서 반환하는 time_bucket 필드
    average_price: item.average_price,   // RPC에서 반환하는 average_price 필드
    specification: item.specification,
    unit: item.unit
  }));
  
  console.log('Processed data before caching:', processedData.length, '개 항목');
  
  // 조회 결과를 Redis 캐시에 저장 (24시간 TTL)
  await setMaterialDataToCache(materials, startDate, endDate, interval, processedData);
  
  return processedData;
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

  return Object.values(groupedData);
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
        // 우축이 비어있고 좌축과 차이가 10배 이상이면서 
        // 절대 가격 차이도 1000원 이상인 경우에만 우축에 배치
        const priceDifference = Math.abs(leftAxisRange.max - currentMaterial.max);
        const rangeRatio = Math.max(leftAxisRange.range, currentMaterial.range) / 
                          Math.min(leftAxisRange.range, currentMaterial.range);
        
        if (rangeRatio >= 10 && priceDifference >= 1000) {
          rightAxisMaterials.push(currentMaterial.material);
        } else {
          leftAxisMaterials.push(currentMaterial.material);
          leftAxisRange = {
            material: 'combined',
            min: Math.min(leftAxisRange.min, currentMaterial.min),
            max: Math.max(leftAxisRange.max, currentMaterial.max),
            range: Math.max(leftAxisRange.max, currentMaterial.max) - 
                   Math.min(leftAxisRange.min, currentMaterial.min)
          };
        }
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

  // 데이터 범위에 여유 공간 추가 (상하 10% 패딩)
  const range = max - min;
  const padding = range * 0.1; // 10% 패딩
  const paddedMin = Math.max(0, min - padding); // 최소값이 0보다 작아지지 않도록 제한
  const paddedMax = max + padding;

  // 적절한 눈금 간격 계산 (패딩된 범위 기준)
  const tickInterval = calculateTickInterval(paddedMin, paddedMax, 5);
  
  // 도메인 범위를 눈금에 맞춰 조정
  const domainMin = Math.max(0, Math.floor(paddedMin / tickInterval) * tickInterval); // 최소값이 0보다 작아지지 않도록 제한
  const domainMax = Math.ceil(paddedMax / tickInterval) * tickInterval;
  
  // 눈금 배열 생성
  const ticks: number[] = [];
  for (let tick = domainMin; tick <= domainMax; tick += tickInterval) {
    ticks.push(tick);
  }
  
  // 최소 3개, 최대 7개의 눈금 보장
  if (ticks.length < 3) {
    const additionalTicks = Math.ceil((3 - ticks.length) / 2);
    const newMin = Math.max(0, domainMin - (additionalTicks * tickInterval)); // 최소값이 0보다 작아지지 않도록 제한
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
      
      // 디버깅 로그 (PP, HDPE 자재의 경우)
      if (material.displayName.includes('PP') || material.displayName.includes('HDPE')) {
        console.log(`테이블 ${material.displayName} 자재 변환: ${material.displayName} (${material.id}) - 원본가격: ${rawPrice}, 단위: ${actualUnit}, 톤단위인가: ${isLargeUnit}`);
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
        
        if (previousPrice !== 0) {
          monthlyChange = ((currentPrice - previousPrice) / previousPrice) * 100;
          monthlyChange = Math.round(monthlyChange * 100) / 100;
        } else {
          monthlyChange = null; // 0 대신 null로 설정하여 '-' 표시
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
      <CardContent className="p-4">
        <div className="h-64 w-full relative">
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
              <LineChart data={chartData} margin={{ top: 2, right: 2, left: 1, bottom: 2 }}>
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
                  width={80}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={formatYAxisPrice}
                  domain={axisAssignment.leftAxisDomain}
                  axisLine={false}
                  tickLine={false}
                />
                
                {/* 보조축 (우측) - 우축 자재가 있을 때만 표시 */}
                {axisAssignment.rightAxisMaterials.length > 0 && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    width={80}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickFormatter={formatYAxisPrice}
                    domain={axisAssignment.rightAxisDomain}
                    axisLine={false}
                    tickLine={false}
                  />
                )}
                
                <Tooltip
                  wrapperClassName="text-xs"
                  formatter={(value: number, name: string) => {
                    return [formatTooltipValue(value), name];
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
                <div className="flex gap-3">
                  {axisAssignment.leftAxisMaterials.map((materialName) => {
                    const materialIndex = materials.findIndex(m => m.displayName === materialName);
                    return (
                      <div key={materialName} className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-0.5 rounded"
                          style={{ backgroundColor: COLORS[materialIndex % COLORS.length] }}
                        />
                        <span className="text-xs text-gray-700 whitespace-nowrap">{materialName}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* 우측 범례 (보조축) */}
            <div className="flex-1 flex justify-end">
              {axisAssignment.rightAxisMaterials.length > 0 && (
                <div className="flex gap-3 justify-end">
                  {axisAssignment.rightAxisMaterials.map((materialName) => {
                    const materialIndex = materials.findIndex(m => m.displayName === materialName);
                    return (
                      <div key={materialName} className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-0.5 rounded"
                          style={{ backgroundColor: COLORS[materialIndex % COLORS.length] }}
                        />
                        <span className="text-xs text-gray-700 whitespace-nowrap">{materialName}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* 가격 정보 테이블 */}
        <div className="mt-5">
          <PriceTable data={tableData} isLoading={isLoading} />
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardMiniChart;
