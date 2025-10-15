import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import useMaterialStore from '@/store/materialStore';
import { createClient } from '@/utils/supabase/client'; // 표준 클라이언트 import
import { formatWeekLabel, formatXAxisLabel } from "@/utils/dateFormatter";

const supabase = createClient(); // Supabase 클라이언트 생성

const shortenMaterialName = (materialName: string, otherMaterials: string[]): string => {
  const parts = materialName.split(' ');
  const keywordMap: { [key: string]: string } = {
    '공진식': '공진식',
    '자흡식펌프': '자흡식펌프',
    '자자흡식펌프': '자자흡식펌프',
    '고강도': '고강도',
    '아��no다이징': '아��no다이징',
    '알루미늄': '알루미늄',
    '복합판넬': '복합판넬',
    '스테인리스': '스테인리스',
    'SUS304': 'SUS304',
    'SUS316': 'SUS316',
    'AL6061': 'AL6061',
    '고장력철근': '고장력철근',
    'H형강': 'H형강',
    'COPPER': '구리',
    'NICKEL': '니켈',
    'SILVER': '은',
    'PTFE': 'PTFE',
    'ABS': 'ABS',
    'PC': 'PC',
    'HDPE': 'HDPE'
  };

  // 주요 키워드 찾기 (긴 키워드부터 우선 매칭)
  let mainKeywords: string[] = [];
   const sortedKeywords = Object.keys(keywordMap).sort((a, b) => b.length - a.length);
   
   for (const keyword of sortedKeywords) {
      if (materialName.includes(keyword)) {
          mainKeywords.push(keywordMap[keyword]);
          break; // 첫 번째 매칭된 키워드만 사용
      }
  }

  // 주요 키워드가 없으면 첫 번째 단어들 사용
  if (mainKeywords.length === 0) {
      const words = materialName.split(/[\s-_,()]+/).filter(w => w.length > 0);
      mainKeywords = words.slice(0, 2);
  }

  // 기본 이름 생성
  let displayName = mainKeywords.join(' ');
  
  // 재질 정보 추출 (SUS304, SUS316 등)
  const materialMatch = materialName.match(/(SUS\d+|AL\d+|SS\d+)/i);
  if (materialMatch && !displayName.includes(materialMatch[1])) {
      displayName += `(${materialMatch[1]})`;
  }
  
  // 구경/크기 정보 추출
  const sizeMatch = materialName.match(/구경[^0-9]*(\d+(?:\.\d+)?[A-Za-z]*)/i) || 
                   materialName.match(/(\d+(?:\.\d+)?(?:mm|A|㎜))/i);
  if (sizeMatch) {
      displayName += ` ${sizeMatch[1]}`;
  }
  
  // 중복 체크 및 추가 구분자
  const duplicates = otherMaterials.filter(other => {
      const otherBase = createBaseName(other);
      const currentBase = createBaseName(materialName);
      return otherBase === currentBase && other !== materialName;
  });

  // 중복이 있으면 추가 구분자 적용
  if (duplicates.length > 0) {
      // BF, 펌프 타입 등 추가 정보
      const typeMatch = materialName.match(/\(([^)]+)\)/g);
      if (typeMatch) {
          const types = typeMatch.map(match => match.replace(/[()]/g, ''));
          const uniqueTypes = types.filter(type => 
              !displayName.includes(type) && 
              !['SUS304', 'SUS316', 'AL6061'].includes(type)
          );
          if (uniqueTypes.length > 0) {
              displayName += ` ${uniqueTypes[0]}`;
          }
      }
  }

  return displayName.length > 30 ? displayName.substring(0, 30) + '...' : displayName;
};

const createBaseName = (name: string): string => {
  const keywordMap: { [key: string]: string } = {
      '공진식': '공진식',
      '자흡식펌프': '자흡식펌프',
      '자자흡식펌프': '자자흡식펌프',
      '고강도': '고강도',
      '아��no다이징': '아��no다이징',
      '알루미늄': '알루미늄',
      '복합판넬': '복합판넬',
      '스테인리스': '스테인리스',
      'SUS304': 'SUS304',
      'SUS316': 'SUS316'
  };

  let keywords: string[] = [];
  const sortedKeywords = Object.keys(keywordMap).sort((a, b) => b.length - a.length);
  
  for (const keyword of sortedKeywords) {
      if (name.includes(keyword)) {
          keywords.push(keywordMap[keyword]);
          break;
      }
  }

  if (keywords.length === 0) {
      const words = name.split(/[\s-_,()]+/).filter(w => w.length > 0);
      keywords = words.slice(0, 1);
  }

  return keywords.join(' ');
};

// [유지] 숫자에 천 단위 구분자 추가하는 함수
  export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('ko-KR').format(value);
};

// 단위 정보를 포함한 툌팁 포맷팅 함수 - 소수점 첫째자리까지 표시
const formatTooltipValue = (value: number, unit?: string): string => {
  const formattedValue = value.toFixed(1);
  return `${formattedValue.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')}원${unit ? `/${unit}` : ''}`;
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

  // 가격 범위에 따라 자재들을 정렬 (평균 가격 기준)
  materialRanges.sort((a, b) => {
    const avgA = (a.min + a.max) / 2;
    const avgB = (b.min + b.max) / 2;
    return avgB - avgA; // 높은 가격부터 정렬
  });

  // 가장 높은 가격대의 자재를 주축(좌측)에 배치
  const leftAxisMaterials = [materialRanges[0].material];
  const rightAxisMaterials: string[] = [];

  let leftAxisRange = materialRanges[0];

  // 두 번째 자재부터 처리
  for (let i = 1; i < materialRanges.length; i++) {
    const currentMaterial = materialRanges[i];
    
    // 현재 좌축 범위와의 차이 비율 계산
    // 현재 좌축 범위와의 차이 비율 계산
    calculateRangeDifferenceRatio(
      leftAxisRange.range, 
      currentMaterial.range
    );

    // 가격 차이 비율 계산 (평균 가격 기준)
    const leftAvg = (leftAxisRange.min + leftAxisRange.max) / 2;
    const currentAvg = (currentMaterial.min + currentMaterial.max) / 2;
    const priceRatio = Math.max(leftAvg, currentAvg) / Math.min(leftAvg, currentAvg);

    // 우축이 비어있거나, 좌축과의 차이가 3배 미만이면 좌축에 배치
    if (rightAxisMaterials.length === 0 && priceRatio < 3) {
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

        const rightAvg = (rightAxisRange.min + rightAxisRange.max) / 2;
        const priceRatioWithRight = Math.max(rightAvg, currentAvg) / Math.min(rightAvg, currentAvg);

        // 좌축과 우축 중 가격 차이가 더 적은 곳에 배치
        if (priceRatio <= priceRatioWithRight) {
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
        // 우축이 비어있고 좌축과 가격 차이가 3배 이상인 경우 우축에 배치
        if (priceRatio >= 3) {
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
    ? (() => {
        const [domainMin, domainMax, ticks] = calculateRightAxisDomain(data, rightAxisMaterials);
        return { domain: [domainMin, domainMax], ticks };
      })()
    : { domain: ['dataMin - 100', 'dataMax + 100'], ticks: [] };

  return {
    leftAxisMaterials,
    rightAxisMaterials,
    leftAxisDomain: leftAxisDomain.domain,
    rightAxisDomain: rightAxisDomain.domain
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

// 사용자 요구사항에 맞춘 새로운 Y축 도메인과 눈금 계산 함수 - 범위를 4로 나누어 5개 눈금 생성
const calculateFixedYAxisDomain = (data: any[], materials: string[]): [number, number, number[]] => {
  if (!data || data.length === 0) {
    return [0, 1000, [0, 250, 500, 750, 1000]];
  }

  let min = Infinity;
  let max = -Infinity;

  // 선택된 날짜 범위 내의 자재별 최고가와 최저가 분석
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

  // 데이터 범위에 약간의 여유 공간 추가 (상하 5%)
  const range = max - min;
  const padding = range * 0.05;
  let paddedMin = Math.max(0, min - padding);
  let paddedMax = max + padding;

  // 범위가 0인 경우 (모든 값이 동일한 경우) 기본 범위 설정
  if (paddedMax === paddedMin) {
    const baseValue = paddedMin;
    paddedMin = Math.max(0, baseValue - 200);
    paddedMax = baseValue + 200;
  }

  // 전체 범위를 4로 나누어 5개의 눈금 생성
  const totalRange = paddedMax - paddedMin;
  const tickInterval = totalRange / 4;

  // 눈금 값들을 적절히 반올림하여 깔끔한 숫자로 만들기
  const magnitude = Math.pow(10, Math.floor(Math.log10(tickInterval)));
  const normalizedInterval = tickInterval / magnitude;
  
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
  
  const finalInterval = niceInterval * magnitude;

  // 시작점을 깔끔한 숫자로 조정
  const domainMin = Math.max(0, Math.floor(paddedMin / finalInterval) * finalInterval);
  
  // 정확히 5개의 눈금 생성
  const ticks: number[] = [];
  for (let i = 0; i < 5; i++) {
    ticks.push(domainMin + (finalInterval * i));
  }

  const domainMax = ticks[4]; // 마지막 눈금이 최대값

  return [domainMin, domainMax, ticks];
};

const calculateSmartYAxisDomain = (data: any[], materials: string[]): [number, number, number[]] => {
  if (!data || data.length === 0 || materials.length === 0) {
    return [0, 1000, [0, 250, 500, 750, 1000]];
  }

  let min = Infinity;
  let max = -Infinity;

  data.forEach(item => {
    materials.forEach(material => {
      const value = item[material];
      // 더 엄격한 숫자 검증
      if (typeof value === 'number' && isFinite(value) && value >= 0) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    });
  });

  if (min === Infinity || max === -Infinity) {
    return [0, 1000, [0, 250, 500, 750, 1000]];
  }

  // 데이터 범위에 최소한의 여유 공간만 추가 (상하 2% 패딩으로 줄임)
  const range = max - min;
  const padding = range * 0.02; // 10%에서 2%로 줄임
  const paddedMin = Math.max(0, min - padding); // 최소값이 0보다 작아지지 않도록 제한
  const paddedMax = max + padding;

  // 적절한 눈금 간격 계산 (패딩된 범위 기준)
  const tickInterval = calculateTickInterval(paddedMin, paddedMax, 5);
  
  // 도메인 범위를 눈금에 맞춰 조정하되, 데이터에 더 가깝게 설정
  const domainMin = Math.max(0, Math.floor(paddedMin / tickInterval) * tickInterval);
  const domainMax = Math.ceil(paddedMax / tickInterval) * tickInterval;
  
  // 눈금 배열 생성
  const ticks: number[] = [];
  for (let tick = domainMin; tick <= domainMax; tick += tickInterval) {
    ticks.push(tick);
  }
  
  // 최소 3개, 최대 7개의 눈금 보장하되 데이터 범위를 벗어나지 않도록 조정
  if (ticks.length < 3) {
    const additionalTicks = Math.ceil((3 - ticks.length) / 2);
    const newMin = Math.max(0, domainMin - (additionalTicks * tickInterval));
    const newMax = domainMax + (additionalTicks * tickInterval);
    
    ticks.length = 0;
    for (let tick = newMin; tick <= newMax; tick += tickInterval) {
      ticks.push(tick);
    }
  }
  
  return [ticks[0], ticks[ticks.length - 1], ticks];
};

// 올림 처리 로직 함수
const roundUpValue = (value: number): number => {
  if (value >= 100000) {
    // 100,000원 이상은 만원 단위에서 올림
    return Math.ceil(value / 10000) * 10000;
  } else if (value >= 10000) {
    // 10,000원 이상은 천원 단위에서 올림
    return Math.ceil(value / 1000) * 1000;
  } else if (value >= 1000) {
    // 1,000원 이상은 백원 단위에서 올림
    return Math.ceil(value / 100) * 100;
  } else {
    // 1,000원 미만은 십원 단위에서 올림
    return Math.ceil(value / 10) * 10;
  }
};

// 내림 처리 로직 함수
const roundDownValue = (value: number): number => {
  if (value >= 100000) {
    // 100,000원 이상은 만원 단위에서 내림
    return Math.floor(value / 10000) * 10000;
  } else if (value >= 10000) {
    // 10,000원 이상은 천원 단위에서 내림
    return Math.floor(value / 1000) * 1000;
  } else if (value >= 1000) {
    // 1,000원 이상은 백원 단위에서 내림
    return Math.floor(value / 100) * 100;
  } else {
    // 1,000원 미만은 십원 단위에서 내림
    return Math.floor(value / 10) * 10;
  }
};

// 새로운 축 범위 계산 함수 - 최대값과 최소값 모두 고려
const calculateOptimizedAxisDomain = (data: any[], materials: string[]): [number, number, number[]] => {
  if (!data || data.length === 0 || materials.length === 0) {
    return [0, 1000, [0, 250, 500, 750, 1000]];
  }

  let min = Infinity;
  let max = -Infinity;

  // 자재들의 실제 가격 범위 분석
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

  // 최대값에 25% 마진 적용 후 올림
  const maxWithMargin = max * 1.25;
  const roundedMax = roundUpValue(maxWithMargin);

  // 최소값에 25% 마진 적용 후 내림 (0.75를 곱함)
  const minWithMargin = min * 0.75;
  const roundedMin = Math.max(0, roundDownValue(minWithMargin)); // 0보다 작아지지 않도록

  // 범위 계산 후 4로 나누어 5개의 눈금 생성
  const range = roundedMax - roundedMin;
  const tickInterval = range / 4;

  // 정확히 5개의 눈금 생성
  const ticks: number[] = [];
  for (let i = 0; i < 5; i++) {
    ticks.push(roundedMin + (tickInterval * i));
  }

  return [roundedMin, roundedMax, ticks];
};

// 우축 전용 도메인 계산 함수 - 새로운 로직 적용
const calculateRightAxisDomain = (data: any[], materials: string[]): [number, number, number[]] => {
  return calculateOptimizedAxisDomain(data, materials);
};

// Y축 도메인 계산 함수 (새로운 최적화된 로직 적용)
const calculateYAxisDomain = (data: any[], materials: string[]) => {
  const [domainMin, domainMax, ticks] = calculateOptimizedAxisDomain(data, materials);
  return { domain: [domainMin, domainMax], ticks };
};

// [수정] 자재 가격 데이터 조회 함수 - API 라우트 호출
const fetchPriceData = async (
  materials: string[],
  startDate: string,
  endDate: string,
  interval: 'weekly' | 'monthly' | 'yearly'
) => {
  if (materials.length === 0) return [];

  // 타임아웃 설정 (25초)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch('/api/materials/prices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ materials, startDate, endDate, interval }),
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'API 요청 실패' }));
      throw new Error(errorData.error || 'Failed to fetch price data');
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }
    throw error;
  }
};

// [수정] 차트 데이터 변환 함수 - RPC 응답 구조 처리 및 배열 타입 보장, ton→kg 변환 포함
const transformDataForChart = (data: any[], visibleMaterials: string[], interval: 'weekly' | 'monthly' | 'yearly') => {
  if (!data || !Array.isArray(data) || data.length === 0) return [];

  console.log('transformDataForChart 입력:', {
    dataLength: data.length,
    firstItem: data[0],
    visibleMaterials,
    interval
  });

  const groupedData = data.reduce((acc, item) => {
    // RPC 응답에서 time_bucket, specification, average_price, unit 필드 사용
    const { time_bucket, specification, average_price, unit } = item;
    
    if (!acc[time_bucket]) {
      acc[time_bucket] = { time_bucket };
    }
    
    // 가격 데이터 처리 (숫자로 변환)
    const numericPrice = typeof average_price === 'number' ? average_price : parseFloat(average_price);
    if (!isNaN(numericPrice)) {
      // ton 단위인 경우 kg으로 변환 (가격을 1/1000로 변환)
      const convertedPrice = unit === 'ton' ? numericPrice / 1000 : numericPrice;
      acc[time_bucket][specification] = convertedPrice;
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
  
  console.log('transformDataForChart 결과:', {
    resultLength: sortedResult.length,
    firstResult: sortedResult[0],
    lastResult: sortedResult[sortedResult.length - 1]
  });
  
  return sortedResult;
};

// 주어진 연도, 월, 주차에 대한 ISO 주간 번호 계산
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

// [삭제] assignYAxis 함수는 더 이상 필요하지 않습니다.

// [유지] 색상 팔레트
const COLORS = [
  '#6366f1', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

// Y축 가격 포맷팅 함수 - 소수점 첫째자리까지 표시
const formatYAxisPrice = (value: number) => {
  // 소수점 첫째 자리까지 표시
  const formattedValue = value.toFixed(1);
  return `${formattedValue.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')}원`;
};

// [수정] 커스텀 범례 컴포넌트 - 실제 축 배치에 따른 범례 배치 및 단위 표시
// CustomizedLegend is defined but not used; remove the unused component
interface CustomLegendProps {
  payload?: any[];
  onVisibilityChange?: (material: string) => void;
  hiddenMaterials?: Set<string>;
  axisAssignment?: {
    leftAxisMaterials: string[];
    rightAxisMaterials: string[];
  };
  unitMap?: Map<string, string>;
}

const CustomLegend: React.FC<CustomLegendProps> = (props) => {
  const { payload, onVisibilityChange, hiddenMaterials, axisAssignment, unitMap } = props;

  if (!payload || payload.length === 0 || !axisAssignment) return null;

  // 실제 축 배치에 따라 범례 아이템을 좌/우로 분리
  const leftPayload = payload.filter((p: any) => 
    axisAssignment.leftAxisMaterials.includes(p.dataKey)
  );
  const rightPayload = payload.filter((p: any) => 
    axisAssignment.rightAxisMaterials.includes(p.dataKey)
  );

  const renderLegendItems = (items: any[], title: string) => (
    <div className="flex-1 min-w-0">
      {items.length > 0 && (
        <>
          <div className="text-xs font-medium text-gray-600 mb-2">{title}</div>
          <div className="flex flex-wrap gap-2 overflow-hidden">
            {items.map((entry: any, index: number) => {
              const materialName = entry.dataKey;
              const materialUnit = unitMap?.get(materialName) || 'kg';
              const isHidden = hiddenMaterials?.has(materialName) ?? false;

              return (
                <div 
                  key={`${title}-${materialName}-${index}`} 
                  className={`flex items-center space-x-1 cursor-pointer transition-opacity min-w-0 flex-shrink-0 ${isHidden ? 'opacity-50' : 'opacity-100'}`}
                  onClick={() => onVisibilityChange?.(materialName)}
                >
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs text-gray-700 truncate max-w-[120px]" title={`${shortenMaterialName(entry.value as string, payload.map((p: { dataKey: string }) => p.dataKey))} (원/${materialUnit})`}>
                    {shortenMaterialName(entry.value as string, payload.map((p: { dataKey: string }) => p.dataKey))} (원/{materialUnit})
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="mt-4 px-3 py-3 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex gap-6">
        {renderLegendItems(leftPayload, '주축 (왼쪽)')}
        {renderLegendItems(rightPayload, '보조축 (오른쪽)')}
      </div>
    </div>
  );
};

interface MaterialsChartProps {
  tableRowCount?: number;
}

const MaterialsChart: React.FC<MaterialsChartProps> = ({ tableRowCount = 0 }) => {
  const {
    interval, setInterval, startDate, endDate, setDateRange,
    selectedMaterialsForChart,
    hiddenMaterials,
    toggleMaterialVisibility,
  } = useMaterialStore();

  const handleLegendVisibilityChange = (material: string) => {
    toggleMaterialVisibility(material);
  };

  const [shouldRotateLabels, setShouldRotateLabels] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // visibleMaterials를 useMemo로 최적화하여 무한 렌더링 방지
  // 토글 스위치에 의해 숨겨진 자재는 차트에서 제외
  const visibleMaterials = useMemo(() => {
    return selectedMaterialsForChart.filter(m => !hiddenMaterials.has(m));
  }, [selectedMaterialsForChart, hiddenMaterials]);

  console.log('MaterialsChart 렌더링:', {
    selectedMaterialsForChart,
    visibleMaterials,
    startDate,
    endDate,
    interval
  });

  const { data: rawData, isLoading, isError, error } = useQuery({
    queryKey: ['materialPrices', visibleMaterials, startDate, endDate, interval],
    queryFn: () => fetchPriceData(visibleMaterials, startDate, endDate, interval),
    enabled: visibleMaterials.length > 0,
    staleTime: 1000 * 60 * 5, // 5분
  });

  console.log('useQuery 상태:', {
    isLoading,
    isError,
    error,
    rawDataLength: rawData?.length || 0,
    rawData: rawData ? rawData.slice(0, 2) : undefined // 안전한 접근
  });
  
  const chartData = useMemo(() => {
    // rawData가 undefined이거나 null인 경우 안전하게 처리
    if (!rawData) {
      console.log('rawData가 undefined 또는 null입니다.');
      return [];
    }
    
    const transformed = transformDataForChart(rawData, visibleMaterials, interval);
    const chartArray = Array.isArray(transformed) ? transformed : [];
    
    console.log('차트 데이터 변환:', {
      rawDataLength: rawData?.length || 0,
      transformedLength: chartArray.length,
      chartArray: chartArray.slice(0, 2) // 처음 2개 데이터만 로그
    });
    
    // 원본 데이터를 그대로 사용 (단위 변환 제거)
    return chartArray;
  }, [rawData, visibleMaterials, interval]);

  // 스마트 Y축 배치 계산
  const axisAssignment = useMemo(() => {
    return calculateSmartAxisAssignment(chartData, visibleMaterials);
  }, [chartData, visibleMaterials]);

  // 범례 높이 계산 (자재 수에 따른 동적 계산)
  const calculateLegendHeight = useMemo(() => {
    if (!visibleMaterials || visibleMaterials.length === 0) return 0;
    
    const leftCount = axisAssignment?.leftAxisMaterials?.length || 0;
    const rightCount = axisAssignment?.rightAxisMaterials?.length || 0;
    const maxCount = Math.max(leftCount, rightCount);
    
    // 각 범례 아이템당 약 20px + 패딩
    return Math.max(maxCount * 20 + 10, 30);
  }, [visibleMaterials, axisAssignment]);

  // 차트 높이 계산 (테이블 행 수에 따라 동적 조정)
  const calculateChartHeight = useMemo(() => {
    if (!chartRef.current) return 500;
    
    // 기본 뷰포트 높이 (브라우저 창 높이)
    const viewportHeight = window.innerHeight;
    
    // 페이지 상단 여백 (헤더, 네비게이션 등) - 대략 150px
    const pageHeaderHeight = 150;
    
    // 차트 헤더 높이 (CardHeader) - 대략 60px
    const chartHeaderHeight = 60;
    
    // 테이블 행당 높이 (헤더 1행 + 데이터 행들) - 각 행당 약 32px
    const rowHeight = 32;
    const tableHeight = (tableRowCount + 1) * rowHeight; // +1은 헤더 행
    
    // 여백 및 패딩 - 대략 120px (테이블 공간 확보를 위해 증가)
    const margins = 180; // 테이블 공간 확보를 위해 추가 증가
    
    // 사용 가능한 차트 높이 계산
    const availableHeight = viewportHeight - pageHeaderHeight - chartHeaderHeight - tableHeight - margins - 30; // 30px offset으로 높이 약간 줄임
    
    // 최소/최대 높이 제한
    const minHeight = 200;
    const maxHeight = 500;
    
    // 계산된 높이가 최소값보다 작으면 최소값 사용, 최대값보다 크면 최대값 사용
    return Math.max(minHeight, Math.min(maxHeight, availableHeight));
  }, [tableRowCount]);

  // X축 라벨 간격 계산 (월 단위로 표시)
  const xAxisInterval = useMemo(() => {
    if (!chartData || chartData.length === 0) return 0;
    
    // 월간 데이터의 경우 매월 표시하도록 설정
    if (interval === 'monthly') {
      return 0; // 모든 월 표시
    }
    
    // 주간 데이터의 경우 4주마다 (월 단위로) 표시
    if (interval === 'weekly') {
      return 3; // 4주마다 표시 (0, 4, 8, 12...)
    }
    
    // 연간 데이터의 경우 모든 년도 표시
    if (interval === 'yearly') {
      return 0;
    }
    
    return 0;
  }, [chartData, interval]);

  useEffect(() => {
    const checkLabelOverlap = () => {
      if (chartRef.current && chartData) {
        const containerWidth = chartRef.current.offsetWidth;
        const labelCount = chartData.length;
        
        // 레이블 길이에 따른 동적 너비 계산
        let maxLabelWidth = 0;
        chartData.forEach(item => {
          const labelText = formatXAxisLabel((item as { time_bucket: string }).time_bucket, interval);
          // 한글 문자는 영문보다 넓으므로 더 큰 값 사용
          const estimatedWidth = labelText.length * (labelText.match(/[가-힣]/g) ? 12 : 8);
          maxLabelWidth = Math.max(maxLabelWidth, estimatedWidth);
        });
        
        const totalLabelsWidth = labelCount * (maxLabelWidth + 20); // 여백 포함
        const shouldRotate = totalLabelsWidth > containerWidth * 0.9; // 90% 기준
        
        setShouldRotateLabels(shouldRotate);
      }
    };

    checkLabelOverlap();
    window.addEventListener('resize', checkLabelOverlap);
    return () => window.removeEventListener('resize', checkLabelOverlap);
  }, [chartData, interval]);

  // 최적화된 Y축 도메인 계산 (사용자 요구사항에 맞춘 동적 범위)
  const leftAxisConfig = useMemo(() => {
    const [domainMin, domainMax, ticks] = calculateOptimizedAxisDomain(chartData, axisAssignment.leftAxisMaterials);
    return { domain: [domainMin, domainMax], ticks };
  }, [chartData, axisAssignment.leftAxisMaterials]);

  const rightAxisConfig = useMemo(() => {
    const [domainMin, domainMax, ticks] = calculateOptimizedAxisDomain(chartData, axisAssignment.rightAxisMaterials);
    return { domain: [domainMin, domainMax], ticks };
  }, [chartData, axisAssignment.rightAxisMaterials]);
  
  // 격자선용 Y축 포인트 계산 (Y축 실제 ticks 기준)
  const gridHorizontalPoints = useMemo(() => {
    // Y축의 실제 5개 눈금(ticks)에서 첫 번째와 마지막을 제외한 중간 3개 사용
    if (!leftAxisConfig.ticks || leftAxisConfig.ticks.length < 3) return [];
    
    // 첫 번째(최소값)와 마지막(최대값) 제외하고 중간 눈금들만 사용
    const middleTicks = leftAxisConfig.ticks.slice(1, -1);
    
    console.log('gridHorizontalPoints (실제ticks기준):', middleTicks, 'allTicks:', leftAxisConfig.ticks);
    return middleTicks;
  }, [leftAxisConfig.ticks]);


  // 단위 정보 추출 및 변환 처리
  const unitInfo = useMemo(() => {
    if (!rawData || rawData.length === 0) return { displayUnit: 'kg', unitMap: new Map() };
    
    // 각 자재별 단위 정보를 맵으로 저장
    const unitMap = new Map();
    rawData.forEach((item: { unit?: string; specification: string }) => {
      const originalUnit = item.unit || 'kg';
      // ton 단위는 가격 변환 후 kg으로 표시, 다른 단위는 원래 단위 유지
      const displayUnit = originalUnit === 'ton' ? 'kg' : originalUnit;
      unitMap.set(item.specification, displayUnit);
    });
    
    // 대표 단위 (첫 번째 데이터의 단위)
    const firstUnit = rawData[0].unit || 'kg';
    const displayUnit = firstUnit === 'ton' ? 'kg' : firstUnit;
    
    return { displayUnit, unitMap };
  }, [rawData]);

  // 범례 높이 계산 (동적 공간 확보)
  const legendHeight = useMemo(() => {
    if (visibleMaterials.length === 0) return 0;
    const leftItems = axisAssignment.leftAxisMaterials.length;
    const rightItems = axisAssignment.rightAxisMaterials.length;
    const maxItems = Math.max(leftItems, rightItems);
    return maxItems * 18 + 8; // 각 아이템당 18px + 최소 패딩 8px
  }, [visibleMaterials, axisAssignment]);



  return (
    <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="py-1 bg-blue-50 border-b border-gray-100 shadow-sm">
        <CardTitle className="text-xl font-bold text-gray-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
            자재 가격 변동
            {selectedMaterialsForChart.length > 0 && (
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                {visibleMaterials.length}개 표시
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
              <Select onValueChange={setInterval} value={interval}>
                <SelectTrigger className="w-full sm:w-24 !h-7 text-sm font-normal bg-white px-3 py-1">
                  <SelectValue placeholder="기간" className="py-0 text-sm" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">주간</SelectItem>
                  <SelectItem value="monthly">월간</SelectItem>
                  <SelectItem value="yearly">연간</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={startDate} onChange={(e) => setDateRange(e.target.value, endDate)} className="w-full sm:w-32 h-7 text-sm font-normal border-gray-300 hover:border-gray-400 transition-colors bg-white" />
              <Input type="date" value={endDate} onChange={(e) => setDateRange(startDate, e.target.value)} className="w-full sm:w-32 h-7 text-sm font-normal border-gray-300 hover:border-gray-400 transition-colors bg-white" />
            </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 bg-white">
        {/* 단위 표시 - 오른쪽 위 */}
        {unitInfo.displayUnit && (
          <div className="absolute top-4 right-6 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded border border-gray-200 z-10">
            단위: 원/{unitInfo.displayUnit}
          </div>
        )}
        
        <div 
          className="bg-white rounded-lg border-0 shadow-none relative"
          style={{ height: `${calculateChartHeight + calculateLegendHeight}px` }}
          ref={chartRef}
        >
          {isLoading ? (
            <div className="space-y-4"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-64 w-full" /></div>
          ) : isError ? (
            <div className="text-red-500 text-center py-8 bg-red-50 rounded-lg border border-red-200"><div className="text-red-600 font-medium">데이터 로딩 실패: {error?.message || error?.toString() || '알 수 없는 오류'}</div></div>
          ) : !chartData || chartData.length === 0 || selectedMaterialsForChart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center py-12 bg-white rounded-lg border border-gray-200">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div className="text-gray-700 font-medium text-lg mb-2">자재를 선택해주세요</div>
              <div className="text-gray-500 text-sm max-w-md leading-relaxed">
                자재를 선택하면 기간별 상세 가격을 확인할 수 있습니다.
              </div>
            </div>
          ) : (
            <div className="w-full">
              <ResponsiveContainer width="100%" height={calculateChartHeight}>
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: shouldRotateLabels ? 25 : 5 }}>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="#e5e7eb" 
                      strokeWidth={0.8}
                      horizontal={false} 
                      vertical={false}
                      horizontalPoints={gridHorizontalPoints}
                    />
                    <XAxis 
                    dataKey="time_bucket" 
                    stroke="#6b7280" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={true} 
                    height={shouldRotateLabels ? 60 : 20}
                    interval={xAxisInterval}
                    angle={shouldRotateLabels ? -45 : 0}
                    tick={shouldRotateLabels 
                      ? { fill: '#6b7280', fontWeight: 500, textAnchor: 'end' }
                      : { fill: '#6b7280', fontWeight: 500, textAnchor: 'middle' }
                    }
                    tickFormatter={(value) => formatXAxisLabel(value, interval)}
                  />
                  
                  <YAxis yAxisId="left" stroke="#6b7280" tickFormatter={formatYAxisPrice} fontSize={12} tickLine={false} axisLine={true} tick={{ fill: '#6b7280', fontWeight: 500 }} domain={leftAxisConfig.domain} ticks={leftAxisConfig.ticks} width={50} />
                  
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
                    width={50}
                    hide={axisAssignment.rightAxisMaterials.length === 0} // 우측 축에 표시할 자재가 없을 때만 숨김
                  />
                  
                  {/* 고공대 지지 가격대 관련 코드 제거됨 */}

                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '14px', fontWeight: 500 }}
                    labelStyle={{ color: '#374151', fontWeight: 600 }}
                    formatter={(value: number, name: string) => {
                      const materialUnit = unitInfo.unitMap.get(name) || 'kg';
                      return [formatTooltipValue(value, materialUnit), shortenMaterialName(name, visibleMaterials)];
                    }}
                    labelFormatter={(label) => {
                      return `기간: ${formatXAxisLabel(label, interval)}`;
                    }}
                  />

                  {visibleMaterials.map((material, _index) => {
                    const yAxisId = axisAssignment.leftAxisMaterials.includes(material) ? 'left' : 'right';
                    const materialIndex = selectedMaterialsForChart.findIndex(m => m === material);
                    return (
                      <Line
                        key={material}
                        yAxisId={yAxisId}
                        type="monotone"
                        dataKey={material}
                        stroke={COLORS[materialIndex % COLORS.length]}
                        strokeWidth={3}
                        dot={{ fill: COLORS[materialIndex % COLORS.length], strokeWidth: 2, r: 4, stroke: 'white' }}
                        activeDot={{ r: 6, stroke: COLORS[materialIndex % COLORS.length], strokeWidth: 2, fill: 'white' }}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
              
              {/* 커스텀 범례 - 대시보드 차트와 동일한 방식으로 차트 외부에 렌더링 */}
              {visibleMaterials.length > 0 && (
                <div className="mt-2 flex justify-between items-start">
                  {/* 좌측 범례 (주축) */}
                  <div className="flex-1">
                    {axisAssignment.leftAxisMaterials.length > 0 && (
                      <div className="flex flex-wrap gap-3">
                        {axisAssignment.leftAxisMaterials.map((materialName) => {
                          const materialIndex = selectedMaterialsForChart.findIndex(m => m === materialName);
                          const isHidden = hiddenMaterials.has(materialName);
                          const materialUnit = unitInfo.unitMap.get(materialName) || 'kg';
                          return (
                            <div 
                              key={materialName} 
                              className={`flex items-center space-x-2 cursor-pointer transition-opacity ${isHidden ? 'opacity-50' : 'opacity-100'}`}
                              onClick={() => handleLegendVisibilityChange(materialName)}
                            >
                              <div 
                                className="w-3 h-0.5 rounded"
                                style={{ backgroundColor: COLORS[materialIndex % COLORS.length] }}
                              />
                              <span className="text-xs text-gray-700 whitespace-nowrap">
                                {shortenMaterialName(materialName, selectedMaterialsForChart)} (원/{materialUnit})
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
                      <div className="flex gap-3 justify-end overflow-hidden">
                        {axisAssignment.rightAxisMaterials.map((materialName) => {
                          const materialIndex = selectedMaterialsForChart.findIndex(m => m === materialName);
                          const isHidden = hiddenMaterials.has(materialName);
                          const materialUnit = unitInfo.unitMap.get(materialName) || 'kg';
                          return (
                            <div 
                              key={materialName} 
                              className={`flex items-center space-x-2 cursor-pointer transition-opacity ${isHidden ? 'opacity-50' : 'opacity-100'}`}
                              onClick={() => handleLegendVisibilityChange(materialName)}
                            >
                              <div 
                                className="w-3 h-0.5 rounded"
                                style={{ backgroundColor: COLORS[materialIndex % COLORS.length] }}
                              />
                              <span className="text-xs text-gray-700 whitespace-nowrap">
                                {shortenMaterialName(materialName, selectedMaterialsForChart)} (원/{materialUnit})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MaterialsChart;