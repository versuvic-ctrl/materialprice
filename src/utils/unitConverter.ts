/**
 * 단위 변환 유틸리티 함수들
 * 
 * 기능:
 * - 톤 단위를 kg 단위로 변환
 * - 가격 단위 변환 (원/톤 → 원/kg)
 * - 단위 표준화 및 정규화
 * 
 * 사용처:
 * - MaterialsChart.tsx
 * - DashboardMiniChart.tsx
 * - PriceTable.tsx
 * - 기타 가격 표시 컴포넌트
 */

export interface PriceData {
  price: number;
  unit: string;
}

export interface ConvertedPriceData {
  price: number;
  unit: string;
  originalPrice: number;
  originalUnit: string;
}

/**
 * 가격과 단위를 kg 기준으로 표준화
 * @param price 원본 가격
 * @param unit 원본 단위
 * @returns 변환된 가격 데이터
 */
export const convertToKgUnit = (price: number, unit: string): ConvertedPriceData => {
  const originalPrice = price;
  const originalUnit = unit;

  const normalizedUnit = unit.toLowerCase().trim();

  let convertedPrice = price;

  // 'ton' 또는 '톤' 단위일 경우 kg 단위로 변환 (1톤 = 1000kg)
  if (normalizedUnit === 'ton' || normalizedUnit === '톤' || normalizedUnit.includes('톤')) {
    convertedPrice = price / 1000;
  } 
  // 'kg' 단위는 변환 필요 없음
  else if (normalizedUnit === 'kg' || normalizedUnit.includes('kg')) {
    convertedPrice = price;
  }

  return {
    price: convertedPrice,
    unit: 'kg', // 변환 후 단위는 항상 'kg'
    originalPrice,
    originalUnit,
  };
};

/**
 * 배열 데이터의 가격을 일괄 변환
 * @param data 원본 데이터 배열
 * @param priceField 가격 필드명 (기본: 'price')
 * @param unitField 단위 필드명 (기본: 'unit')
 * @returns 변환된 데이터 배열
 */
export const convertPriceArrayToKg = (
  data: any[], 
  priceField: string = 'price', 
  unitField: string = 'unit'
): any[] => {
  return data.map(item => {
    const originalPrice = parseFloat(item[priceField] || '0');
    const originalUnit = item[unitField] || 'kg';
    
    const converted = convertToKgUnit(originalPrice, originalUnit);
    
    return {
      ...item,
      [priceField]: converted.price,
      [unitField]: converted.unit,
      originalPrice: converted.originalPrice,
      originalUnit: converted.originalUnit
    };
  });
};

/**
 * 차트 데이터의 가격을 kg 단위로 변환
 * @param data 차트 데이터 배열
 * @param materialFields 자재 필드명 배열
 * @param unit 원본 단위
 * @returns 변환된 차트 데이터
 */
export const convertChartDataToKg = (
  data: any[], 
  materialFields: string[], 
  unit: string = '원/톤'
): any[] => {
  if (!data || data.length === 0) return [];
  
  // 톤 단위를 kg 단위로 변환: 1톤 = 1000kg이므로 가격을 1000으로 나눔
  // 예: 3,000,000원/톤 → 3,000원/kg
  const conversionFactor = unit === '원/톤' || unit.includes('톤') ? 1000 : 1;
  
  return data.map(item => {
    const convertedItem = { ...item };
    
    materialFields.forEach(field => {
      if (convertedItem[field] !== null && convertedItem[field] !== undefined) {
        // 톤 단위인 경우 1000으로 나누어 kg 단위로 변환
        convertedItem[field] = convertedItem[field] / conversionFactor;
      }
    });
    
    return convertedItem;
  });
};

/**
 * 단위 표시명 정규화
 * @param unit 원본 단위
 * @returns 표준화된 단위 표시명
 */
export const normalizeUnitDisplay = (unit: string): string => {
  if (unit === '원/톤' || unit.includes('톤')) {
    return 'kg';
  } else if (unit === '원/kg' || unit.includes('kg')) {
    return 'kg';
  } else {
    return unit.replace('원/', '');
  }
};

/**
 * 가격 변동률 계산 (단위 변환 고려)
 * @param currentPrice 현재 가격
 * @param previousPrice 이전 가격
 * @param unit 단위
 * @returns 변동률 (%)
 */
export const calculatePriceChange = (
  currentPrice: number, 
  previousPrice: number, 
  unit: string = '원/톤'
): number => {
  const currentConverted = convertToKgUnit(currentPrice, unit);
  const previousConverted = convertToKgUnit(previousPrice, unit);
  
  if (previousConverted.price === 0) return 0;
  
  return ((currentConverted.price - previousConverted.price) / previousConverted.price) * 100;
};