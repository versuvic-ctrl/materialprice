// MakeItFrom.json 데이터 구조를 위한 타입 정의

export interface MakeItFromProperty {
  scalars: string;
  units: string;
  name: string;
}

export interface MakeItFromReference {
  url: string;
}

export interface MakeItFromComposition {
  actualWeightPercent: string;
  element: string;
}

export interface MakeItFromMaterial {
  category: string;
  properties: MakeItFromProperty[];
  references: MakeItFromReference[];
  composition?: MakeItFromComposition[];
}

export type MakeItFromDatabase = MakeItFromMaterial[];

// 재료 비교를 위한 추가 타입들
export interface MaterialComparisonItem {
  id: string;
  material: MakeItFromMaterial;
  displayName: string;
}

export interface PropertyComparison {
  propertyName: string;
  unit: string;
  values: {
    materialId: string;
    materialName: string;
    value: string;
    numericValue?: number; // 숫자 비교를 위한 파싱된 값
  }[];
}

// 필터링 및 검색을 위한 타입들
export interface MaterialFilter {
  majorCategory?: string;
  middleCategory?: string;
  subCategory?: string;
  searchTerm?: string;
  properties?: string[];
}

export interface MaterialSearchResult {
  material: MakeItFromMaterial;
  score: number; // 검색 관련성 점수
  matchedProperties: string[];
}

// MakeItFrom.com 계층적 카테고리 구조
export interface CategoryHierarchy {
  major: string;
  middle: string;
  sub?: string;
}

// 대분류 카테고리
export const MAJOR_CATEGORIES = [
  'Metals',
  'Polymerics', 
  'Ceramics'
] as const;

// 중분류 카테고리 (Metals)
export const METAL_CATEGORIES = [
  'Aluminum Alloy',
  'Cobalt Alloy',
  'Copper Alloy', 
  'Iron Alloy',
  'Magnesium Alloy',
  'Nickel Alloy',
  'Titanium Alloy',
  'Zinc Alloy',
  'Other Metal Alloy'
] as const;

// 중분류 카테고리 (Polymerics)
export const POLYMERIC_CATEGORIES = [
  'Thermoplastic',
  'Thermoset Elastomer Rubber',
  'Thermoset Plastic',
  'Wood Based Material'
] as const;

// 중분류 카테고리 (Ceramics)
export const CERAMIC_CATEGORIES = [
  'Glass and Glass Ceramic',
  'Natural Stone',
  'Non-Glass Optical Ceramic',
  'Non-Oxide Engineering Ceramic',
  'Oxide Based Engineering Ceramic'
] as const;

// 전체 카테고리 매핑
export const CATEGORY_MAPPING = {
  'Metals': METAL_CATEGORIES,
  'Polymerics': POLYMERIC_CATEGORIES,
  'Ceramics': CERAMIC_CATEGORIES
} as const;

export type MajorCategory = typeof MAJOR_CATEGORIES[number];
export type MetalCategory = typeof METAL_CATEGORIES[number];
export type PolymericCategory = typeof POLYMERIC_CATEGORIES[number];
export type CeramicCategory = typeof CERAMIC_CATEGORIES[number];
export type MiddleCategory = MetalCategory | PolymericCategory | CeramicCategory;

// 공통 속성 이름들 (비교에 자주 사용되는 속성들)
export const COMMON_PROPERTIES = [
  'Density',
  'Elastic (Young\'s, Tensile) Modulus',
  'Tensile Strength: Ultimate (UTS)',
  'Tensile Strength: Yield (Proof)',
  'Thermal Conductivity',
  'Thermal Expansion',
  'Elongation at Break',
  'Poisson\'s Ratio',
  'Specific Heat Capacity',
  'Melting Onset (Solidus)',
  'Brinell Hardness',
  'Rockwell C Hardness'
] as const;

export type CommonProperty = typeof COMMON_PROPERTIES[number];