/**
 * unitConversion.ts - 영국단위계와 SI단위계 간 변환 유틸리티
 * 
 * 재료 물성 데이터의 단위 변환을 위한 함수들
 */

import { MaterialProperties } from '@/types/materialProperties';

// 단위 변환 계수
export const CONVERSION_FACTORS = {
  // 밀도: lb/in³ → kg/m³
  density: 27679.9047,
  
  // 응력: psi → MPa
  stress: 0.00689476,
  
  // 온도: °F → °C
  temperature: {
    offset: 32,
    factor: 5/9
  },
  
  // 열팽창계수: μin/in/°F → μm/m/°C
  thermalExpansion: 1.8
};

// 단위 정보 인터페이스
export interface UnitInfo {
  imperial: string;
  si: string;
  conversionFactor?: number;
  isTemperature?: boolean;
}

// 물성별 단위 정보
export const UNIT_INFO: Record<string, UnitInfo> = {
  den: {
    imperial: 'lb/in³',
    si: 'kg/m³',
    conversionFactor: CONVERSION_FACTORS.density
  },
  yield_str: {
    imperial: 'psi',
    si: 'MPa',
    conversionFactor: CONVERSION_FACTORS.stress
  },
  ult_str: {
    imperial: 'psi',
    si: 'MPa',
    conversionFactor: CONVERSION_FACTORS.stress
  },
  elongation: {
    imperial: '%',
    si: '%'
  },
  moe: {
    imperial: 'psi',
    si: 'GPa',
    conversionFactor: CONVERSION_FACTORS.stress / 1000 // MPa to GPa
  },
  pr: {
    imperial: '%',
    si: '%'
  },
  max_service_temp: {
    imperial: '°F',
    si: '°C',
    isTemperature: true
  },
  coef_thermal_exp: {
    imperial: 'μin/in/°F',
    si: 'μm/m/°C',
    conversionFactor: CONVERSION_FACTORS.thermalExpansion
  },
  min_extrude_temp: {
    imperial: '°F',
    si: '°C',
    isTemperature: true
  },
  max_extrude_temp: {
    imperial: '°F',
    si: '°C',
    isTemperature: true
  },
  min_bed_temp: {
    imperial: '°F',
    si: '°C',
    isTemperature: true
  },
  max_bed_temp: {
    imperial: '°F',
    si: '°C',
    isTemperature: true
  }
};

/**
 * 화씨를 섭씨로 변환
 */
export const fahrenheitToCelsius = (fahrenheit: number): number => {
  return (fahrenheit - CONVERSION_FACTORS.temperature.offset) * CONVERSION_FACTORS.temperature.factor;
};

/**
 * 섭씨를 화씨로 변환
 */
export const celsiusToFahrenheit = (celsius: number): number => {
  return celsius / CONVERSION_FACTORS.temperature.factor + CONVERSION_FACTORS.temperature.offset;
};

/**
 * 단일 물성값을 영국단위에서 SI단위로 변환
 */
export const convertPropertyToSI = (
  propertyKey: string, 
  value: number | undefined
): number | undefined => {
  if (value === undefined) return undefined;
  
  const unitInfo = UNIT_INFO[propertyKey];
  if (!unitInfo) return value;
  
  if (unitInfo.isTemperature) {
    return fahrenheitToCelsius(value);
  }
  
  if (unitInfo.conversionFactor) {
    return value * unitInfo.conversionFactor;
  }
  
  return value; // 단위 변환이 필요없는 경우 (%, 등)
};

/**
 * 단일 물성값을 SI단위에서 영국단위로 변환
 */
export const convertPropertyToImperial = (
  propertyKey: string, 
  value: number | undefined
): number | undefined => {
  if (value === undefined) return undefined;
  
  const unitInfo = UNIT_INFO[propertyKey];
  if (!unitInfo) return value;
  
  if (unitInfo.isTemperature) {
    return celsiusToFahrenheit(value);
  }
  
  if (unitInfo.conversionFactor) {
    return value / unitInfo.conversionFactor;
  }
  
  return value; // 단위 변환이 필요없는 경우 (%, 등)
};

/**
 * MaterialProperties 객체를 영국단위에서 SI단위로 변환
 */
export const convertPropertiesToSI = (properties: MaterialProperties): MaterialProperties => {
  const converted: MaterialProperties = {};
  
  Object.entries(properties).forEach(([key, value]) => {
    if (typeof value === 'number') {
      converted[key as keyof MaterialProperties] = convertPropertyToSI(key, value);
    }
  });
  
  return converted;
};

/**
 * MaterialProperties 객체를 SI단위에서 영국단위로 변환
 */
export const convertPropertiesToImperial = (properties: MaterialProperties): MaterialProperties => {
  const converted: MaterialProperties = {};
  
  Object.entries(properties).forEach(([key, value]) => {
    if (typeof value === 'number') {
      converted[key as keyof MaterialProperties] = convertPropertyToImperial(key, value);
    }
  });
  
  return converted;
};

/**
 * 물성값을 지정된 소수점 자리수로 반올림
 */
export const roundToDecimalPlaces = (value: number | undefined, decimals: number = 2): number | undefined => {
  if (value === undefined) return undefined;
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

/**
 * 물성값을 포맷팅하여 문자열로 반환 (단위 포함)
 */
export const formatPropertyValue = (
  propertyKey: string,
  value: number | undefined,
  useSI: boolean = false,
  decimals: number = 2
): string => {
  if (value === undefined) return '-';
  
  const unitInfo = UNIT_INFO[propertyKey];
  if (!unitInfo) return value.toString();
  
  const roundedValue = roundToDecimalPlaces(value, decimals);
  if (roundedValue === undefined) return '-';
  
  const unit = useSI ? unitInfo.si : unitInfo.imperial;
  return `${roundedValue.toLocaleString()} ${unit}`;
};

/**
 * 단위 시스템 타입
 */
export type UnitSystem = 'imperial' | 'si';

/**
 * 현재 단위 시스템에 따라 물성값을 변환
 */
export const convertPropertyBySystem = (
  propertyKey: string,
  value: number | undefined,
  fromSystem: UnitSystem,
  toSystem: UnitSystem
): number | undefined => {
  if (value === undefined || fromSystem === toSystem) return value;
  
  if (fromSystem === 'imperial' && toSystem === 'si') {
    return convertPropertyToSI(propertyKey, value);
  } else if (fromSystem === 'si' && toSystem === 'imperial') {
    return convertPropertyToImperial(propertyKey, value);
  }
  
  return value;
};