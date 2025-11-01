/**
 * MaterialsPriceTable.tsx - 자재 가격 정보 테이블 컴포넌트 (자재 상세 페이지용)
 * 
 * 기능:
 * - 선택된 자재별 현재 가격, 전월비, 전년비 표시
 * - 가격 포맷팅 (100,000원 이상은 천원단위, 이하는 원단위)
 * - 변동률에 따른 색상 코딩 (상승: 빨간색, 하락: 파란색, 변동없음: 검은색)
 * - 차트와 동일한 폭으로 깔끔한 정렬
 * - 선택된 자재 목록에 따라 동적으로 행 추가/제거
 * 
 * 연관 파일:
 * - src/app/materials/page.tsx (부모 컴포넌트)
 * - src/store/materialStore.ts (Zustand 전역 상태 관리)
 * 
 * 중요도: ⭐⭐ 중요 - 차트 보완 정보 제공
 */
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabaseClient';
import useMaterialStore from '@/store/materialStore';

// 자재 가격 데이터 타입 정의
interface MaterialPriceData {
  name: string;           // 품목명 (간단 명료하게)
  currentPrice: number;   // 현재 가격
  unit: string;           // 단위 (kg, ton, m 등)
  monthlyChange: number | null;  // 전월비 (%)
  yearlyChange: number | null;   // 전년비 (%)
  twoYearAgoChange: number | null; // 2년전비 (%)
  previousMonthPrice: number | null; // 전월 가격
  yearAgoPrice: number | null;       // 전년 가격
  twoYearAgoPrice: number | null;    // 2년전 가격
  region?: string;        // 지역 (서울1, 서울2, 수원1 등)
  spec_name?: string;     // 상세규격명 (PVC, STS304, STS316, PTFE 등)
}

// 컴포넌트 Props 타입 정의
interface MaterialsPriceTableProps {
  selectedMaterials: string[];
}

// 가격 포맷팅 함수 - 원본 가격 사용
const formatPrice = (price: number): string => {
  return `${Math.round(price).toLocaleString('ko-KR')}원`;
};

// 변동률과 가격을 함께 포맷팅하는 함수
const formatChangeWithPrice = (change: number | null, price: number | null): { text: string; color: string; priceText: string; changeText: string } => {
  if (change === undefined || change === null || isNaN(change) || price === null || price === undefined) {
    return { text: '-', color: 'text-gray-500', priceText: '-', changeText: '-' };
  }
  
  const priceText = `${Math.round(price).toLocaleString('ko-KR')}원`;
  let changeText = '';
  let color = '';
  
  if (change === 0) {
    changeText = '(0.00%)';
    color = 'text-gray-900';
  } else if (change > 0) {
    changeText = `(+${change.toFixed(2)}%)`;
    color = 'text-red-500';
  } else {
    changeText = `(${change.toFixed(2)}%)`;
    color = 'text-blue-500';
  }
  
  return {
    text: `${priceText}${changeText}`,
    color,
    priceText,
    changeText
  };
};

// 톤 단위 감지 함수 - 단위와 자재명을 모두 고려
// 하드코딩된 단위 판별 로직 - 데이터베이스 기반 로직으로 대체됨
/*
const isLargeWeightUnit = (unit: string, materialName: string): boolean => {
  if (!unit && !materialName) return false;
  
  // 단위 기반 판별
  const unitLower = unit?.toLowerCase() || '';
  if (unitLower.includes('ton') || unitLower.includes('톤') || unitLower === 't') {
    return true;
  }
  
  // 자재명 기반 판별 (특정 자재들은 톤 단위로 거래되는 경우가 많음)
  const materialLower = materialName?.toLowerCase() || '';
  
  // PVDF는 제외 - 미터 단위로 거래됨
  if (materialLower.includes('pvdf')) {
    return false;
  }
  
  const largeMaterialKeywords = [
    'pp', 'hdpe', 'ldpe', 'pvc', 'abs', 'pc', 'pa', 'pom', 'pet', 'ps',
    '플라스틱', '수지', '펠릿', '원료', '화학', '석유화학'
  ];
  
  return largeMaterialKeywords.some(keyword => materialLower.includes(keyword));
};
*/

// 5레벨 상세규격이 하나만 있을 때 4레벨만 표시하는 함수
const formatMaterialName = (materialName: string, allMaterials: string[]): string => {
  // 마지막 부분이 크기/규격 정보인지 확인 (예: 2.0mm, 3mm 등)
  const parts = materialName.split(' ');
  const lastPart = parts[parts.length - 1];
  const isSizeSpec = /^\d+(?:\.\d+)?(?:mm|㎜|A|인치|inch)$/i.test(lastPart);
  
  // 크기 규격이 있는 경우
  if (isSizeSpec) {
    const baseNameWithoutSize = parts.slice(0, -1).join(' ');
    const otherBasenames = allMaterials.map(other => {
      const otherParts = other.split(' ');
      const otherLastPart = otherParts[otherParts.length - 1];
      const otherIsSizeSpec = /^\d+(?:\.\d+)?(?:mm|㎜|A|인치|inch)$/i.test(otherLastPart);
      return otherIsSizeSpec ? otherParts.slice(0, -1).join(' ') : other;
    });
    
    // 같은 기본명을 가진 다른 자재가 있는지 확인
    const hasSameBasename = otherBasenames.some(basename => basename === baseNameWithoutSize);
    
    if (!hasSameBasename) {
      // 5레벨이 하나만 있는 경우: 4레벨만 표시 (크기 규격 제거)
      return baseNameWithoutSize;
    } else {
      // 5레벨이 2개 이상 있는 경우: 4레벨+5레벨 형태로 표시 (크기 규격 유지)
      return materialName;
    }
  }
  
  return materialName;
};

const MaterialsPriceTable: React.FC<MaterialsPriceTableProps> = ({ selectedMaterials }) => {
  const { hiddenMaterials, interval, startDate, endDate } = useMaterialStore();

  // 단위 판별 함수 (데이터베이스 단위 정보만 사용)
  const isLargeWeightUnit = (unit: string) => {
    const unitLower = unit.toLowerCase();
    return unitLower.includes('ton') || unitLower.includes('톤');
  };

  const { data: priceData, isLoading, error } = useQuery<MaterialPriceData[], Error>({
    queryKey: ['materialPrices', selectedMaterials, interval, startDate, endDate],
    queryFn: async () => {
      if (selectedMaterials.length === 0) {
        return [];
      }

      // 대시보드와 동일한 방식으로 데이터 가져오기
      const allData: any[] = [];
      
      for (const material of selectedMaterials) {
        try {
          const { data, error } = await supabase.rpc('get_price_data', {
        p_interval: interval === 'monthly' ? 'month' : interval,
        p_start_date: startDate,
        p_end_date: endDate,
        p_specifications: [material],
      });

          if (error) {
            console.error(`자재 ${material} RPC 오류:`, error);
            continue;
          }

          // data가 undefined이거나 null인 경우 안전하게 처리
          if (data && Array.isArray(data) && data.length > 0) {
            allData.push(...data);
          } else {
            console.log(`자재 ${material}: 데이터가 없거나 유효하지 않음`, data);
          }
        } catch (materialError) {
          console.error(`자재 ${material} 처리 중 오류:`, materialError);
          continue;
        }
      }

      // allData가 비어있는 경우 안전하게 처리
      if (!allData || allData.length === 0) {
        console.log('MaterialsPriceTable: 모든 자재에 대한 데이터가 없습니다.');
        return [];
      }

      // 데이터를 MaterialPriceData 형식으로 변환
      const transformedData: MaterialPriceData[] = selectedMaterials.map((material) => {
        const materialData = allData.filter((item: any) => item.specification === material);
        
        if (materialData.length === 0) {
          return {
            name: material,
            currentPrice: 0,
            unit: '',
            monthlyChange: null,
            yearlyChange: null,
            twoYearAgoChange: null,
            previousMonthPrice: null,
            yearAgoPrice: null,
            twoYearAgoPrice: null,
          };
        }

        // 날짜순 정렬 (최신순)
        const sortedData = materialData.sort((a: { time_bucket: string }, b: { time_bucket: string }) => 
          new Date(b.time_bucket).getTime() - new Date(a.time_bucket).getTime()
        );
        
        const rawPrice = parseFloat(sortedData[0]?.average_price || '0');
        
        // 전월비 계산 및 전월 가격 저장
        let monthlyChange: number | null = null;
        let previousMonthPrice: number | null = null;
        if (sortedData.length >= 2) {
          const previousRawPrice = parseFloat(sortedData[1]?.average_price || '0');
          previousMonthPrice = previousRawPrice;
          if (previousRawPrice !== 0) {
            monthlyChange = ((rawPrice - previousRawPrice) / previousRawPrice) * 100;
            monthlyChange = Math.round(monthlyChange * 100) / 100;
          }
        }

        // 전년비 계산 및 전년 가격 저장
        let yearlyChange: number | null = null;
        let yearAgoPrice: number | null = null;
        const yearAgoIndex = Math.min(12, sortedData.length - 1);
        if (yearAgoIndex > 0) {
          const yearAgoRawPrice = parseFloat(sortedData[yearAgoIndex]?.average_price || '0');
          yearAgoPrice = yearAgoRawPrice;
          if (yearAgoRawPrice !== 0) {
            yearlyChange = ((rawPrice - yearAgoRawPrice) / yearAgoRawPrice) * 100;
            yearlyChange = Math.round(yearlyChange * 100) / 100;
          }
        }

        // 2년전비 계산 및 2년전 가격 저장
        let twoYearAgoChange: number | null = null;
        let twoYearAgoPrice: number | null = null;
        const twoYearAgoIndex = Math.min(24, sortedData.length - 1);
        if (twoYearAgoIndex > 0) {
          const twoYearAgoRawPrice = parseFloat(sortedData[twoYearAgoIndex]?.average_price || '0');
          twoYearAgoPrice = twoYearAgoRawPrice;
          if (twoYearAgoRawPrice !== 0) {
            twoYearAgoChange = ((rawPrice - twoYearAgoRawPrice) / twoYearAgoRawPrice) * 100;
            twoYearAgoChange = Math.round(twoYearAgoChange * 100) / 100;
          }
        }

        // 데이터베이스에서 가져온 실제 단위 정보 사용
        const actualUnit = sortedData[0]?.unit || '';
        const shouldConvert = isLargeWeightUnit(actualUnit);
        
        // 단위 변환 적용 (ton -> kg)
        const displayPrice = shouldConvert ? rawPrice / 1000 : rawPrice;
        const displayUnit = shouldConvert ? 'kg' : actualUnit;
        const displayPreviousMonthPrice = shouldConvert && previousMonthPrice ? previousMonthPrice / 1000 : previousMonthPrice;
        const displayYearAgoPrice = shouldConvert && yearAgoPrice ? yearAgoPrice / 1000 : yearAgoPrice;
        const displayTwoYearAgoPrice = shouldConvert && twoYearAgoPrice ? twoYearAgoPrice / 1000 : twoYearAgoPrice;

        return {
          name: material,
          currentPrice: displayPrice,
          unit: displayUnit,
          monthlyChange,
          yearlyChange,
          twoYearAgoChange,
          previousMonthPrice: displayPreviousMonthPrice,
          yearAgoPrice: displayYearAgoPrice,
          twoYearAgoPrice: displayTwoYearAgoPrice,
        };
      });

      return transformedData;
    },
    enabled: selectedMaterials.length > 0,
    staleTime: 5 * 60 * 1000, // 5분간 캐시된 데이터 사용
  });

  if (isLoading) {
    return (
      <div className="w-full mt-2">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-2"></div>
          {[...Array(selectedMaterials.length || 3)].map((_, index) => (
            <div key={index} className="h-6 bg-gray-100 rounded mb-1"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full mt-2 text-center text-sm text-red-500 py-4">
        가격 정보를 불러오는 데 실패했습니다: {error.message}
      </div>
    );
  }

  if (!priceData || priceData.length === 0) {
    return (
      <div className="w-full mt-2 text-center text-sm text-gray-500 py-4">
        
      </div>
    );
  }

  // 숨겨진 자재를 제외하고 필터링
  const visiblePriceData = priceData.filter(item => !hiddenMaterials.has(item.name));

  if (visiblePriceData.length === 0) {
    return (
      <div className="w-full mt-2 text-center text-sm text-gray-500 py-4">
        선택된 모든 자재가 숨겨져 있습니다.
      </div>
    );
  }

  return (
    <div className="w-full mt-2">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {/* 테이블 헤더 */}
        <div className="grid gap-2 px-3 py-2 bg-blue-50 border-b border-gray-200" style={{ gridTemplateColumns: '2.5fr 0.8fr 1.2fr 1.2fr 1.2fr 1.2fr' }}>
          <div className="text-xs font-medium text-gray-700 text-center">품목</div>
            <div className="text-xs font-medium text-gray-700 text-center">단위</div>
            <div className="text-xs font-medium text-gray-700 text-center">2년전비</div>
            <div className="text-xs font-medium text-gray-700 text-center">전년비</div>
            <div className="text-xs font-medium text-gray-700 text-center">전월비</div>
            <div className="text-xs font-medium text-gray-700 text-center">현재가</div>
        </div>
        
        {isLoading && (
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-2"></div>
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-6 bg-gray-100 rounded mb-1"></div>
            ))}
          </div>
        )}

        {error && (
          <div className="text-red-500 text-sm p-3 bg-red-50 rounded">
            가격 정보를 불러오는 중 오류가 발생했습니다: {(error as Error).message}
          </div>
        )}

        {!isLoading && !error && priceData && priceData.length > 0 && (
          <div className="divide-y divide-gray-100">
            {priceData
              .filter(item => !hiddenMaterials.has(item.name))
              .map((item, index) => {
                const monthlyChangeFormat = formatChangeWithPrice(item.monthlyChange, item.previousMonthPrice);
                const yearlyChangeFormat = formatChangeWithPrice(item.yearlyChange, item.yearAgoPrice);
                const twoYearAgoChangeFormat = formatChangeWithPrice(item.twoYearAgoChange, item.twoYearAgoPrice);
                
                return (
                  <div key={index} className="grid gap-2 px-3 py-2 transition-colors" style={{ gridTemplateColumns: '2.5fr 0.8fr 1.2fr 1.2fr 1.2fr 1.2fr' }}>
                    {/* 품목명 */}
                    <div className="text-xs text-gray-900 text-center overflow-hidden text-ellipsis whitespace-nowrap" title={item.name}>
                      {formatMaterialName(item.name, selectedMaterials)}
                    </div>
                    
                    {/* 단위 */}
                    <div className="text-xs text-gray-900 text-center">
                      {item.unit}
                    </div>

                    {/* 2년전비 */}
                    <div className="text-xs text-center font-medium" title={twoYearAgoChangeFormat.text}>
                      <span className="text-gray-900">{twoYearAgoChangeFormat.priceText}</span>
                      <span className={twoYearAgoChangeFormat.color}>{twoYearAgoChangeFormat.changeText}</span>
                    </div>
                    
                    {/* 전년비 */}
                    <div className="text-xs text-center font-medium" title={yearlyChangeFormat.text}>
                      <span className="text-gray-900">{yearlyChangeFormat.priceText}</span>
                      <span className={yearlyChangeFormat.color}>{yearlyChangeFormat.changeText}</span>
                    </div>

                    {/* 전월비 */}
                    <div className="text-xs text-center font-medium" title={monthlyChangeFormat.text}>
                      <span className="text-gray-900">{monthlyChangeFormat.priceText}</span>
                      <span className={monthlyChangeFormat.color}>{monthlyChangeFormat.changeText}</span>
                    </div>

                    {/* 가격 */}
                    <div className="text-xs text-gray-900 text-center font-medium">
                      {formatPrice(item.currentPrice)}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {!isLoading && !error && (!priceData || priceData.length === 0) && (
          <div className="text-center text-xs text-gray-500 py-4">
            표시할 가격 정보가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};

export default MaterialsPriceTable;