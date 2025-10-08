/**
 * materialProperties.ts - 재료 물성정보 타입 정의
 * 
 * GitHub KittyCAD/material-properties 데이터베이스 구조를 기반으로 한 타입 정의
 * 
 * 데이터 소스: https://github.com/KittyCAD/material-properties
 * 
 * 지원 재료 종류:
 * - Aluminum (알루미늄)
 * - Carbon Steel (탄소강)
 * - Low Alloy Steel (저합금강)
 * - Stainless Steel (스테인리스강)
 * - Nickel Alloy (니켈 합금)
 */

// 기본 물성 정보 인터페이스 (모든 단위는 영국 단위계)
export interface MaterialProperties {
  // 밀도 (Density)
  den?: number;                    // lb/in³
  
  // 강도 특성
  yield_str?: number;              // 항복강도 (psi)
  ult_str?: number;                // 인장강도 (psi)
  elongation?: number;             // 연신율 (% - 무단위)
  
  // 탄성 특성
  moe?: number;                    // 탄성계수 (psi)
  pr?: number;                     // 포아송비 (% - 무단위)
  
  // 온도 특성
  max_service_temp?: number;       // 최대 사용온도 (°F)
  coef_thermal_exp?: number;       // 열팽창계수 (μin/in)
  
  // 3D 프린팅 관련 (해당하는 경우)
  min_extrude_temp?: number;       // 최소 압출온도 (°F)
  max_extrude_temp?: number;       // 최대 압출온도 (°F)
  min_bed_temp?: number;           // 최소 베드온도 (°F)
  max_bed_temp?: number;           // 최대 베드온도 (°F)
}

// 재료 조건별 물성 (hot/cold 등)
export interface MaterialCondition {
  hot?: MaterialProperties;        // 고온 조건
  cold?: MaterialProperties;       // 저온 조건
  annealed?: MaterialProperties;   // 어닐링 조건
  normalized?: MaterialProperties; // 노멀라이징 조건
  [condition: string]: MaterialProperties | undefined;
}

// 특정 재료 등급의 물성 정보
export interface MaterialGrade {
  [gradeName: string]: MaterialCondition;
}

// 재료 카테고리별 데이터 구조
export interface MaterialCategory {
  [materialType: string]: MaterialGrade;
}

// 전체 재료 데이터베이스 구조
export interface MaterialDatabase {
  aluminum?: MaterialSelection[];      // 알루미늄 합금
  carbonsteel?: MaterialSelection[];   // 탄소강
  lowalloy?: MaterialSelection[];      // 저합금강
  stainless?: MaterialSelection[];     // 스테인리스강
  nickel?: MaterialSelection[];        // 니켈 합금
  [category: string]: MaterialSelection[] | undefined;
}

// 재료 선택을 위한 인터페이스
export interface MaterialSelection {
  id: string;                      // 고유 식별자
  category: string;                // 재료 카테고리 (aluminum, carbonsteel 등)
  type: string;                    // 재료 타입 (AISI_1020, AL6061 등)
  grade: string;                   // 등급명
  condition: string;               // 조건 (hot, cold, annealed 등)
  displayName: string;             // 표시용 이름
  properties: MaterialProperties;  // 실제 물성 데이터
}

// 물성 비교를 위한 인터페이스
export interface MaterialComparison {
  materials: MaterialSelection[];  // 비교할 재료 목록
  properties: string[];           // 비교할 물성 항목
}

// 물성 단위 정보
export interface PropertyUnit {
  key: string;                    // JSON 키
  name: string;                   // 물성명
  unit: string;                   // 단위
  description: string;            // 설명
}

// 지원되는 물성 목록과 단위 정보
export const PROPERTY_UNITS: PropertyUnit[] = [
  {
    key: 'den',
    name: '밀도',
    unit: 'lb/in³',
    description: 'Density - 재료의 단위 부피당 질량'
  },
  {
    key: 'yield_str',
    name: '항복강도',
    unit: 'psi',
    description: 'Yield Strength - 재료가 소성변형을 시작하는 응력'
  },
  {
    key: 'ult_str',
    name: '인장강도',
    unit: 'psi',
    description: 'Ultimate Strength - 재료가 견딜 수 있는 최대 인장응력'
  },
  {
    key: 'elongation',
    name: '연신율',
    unit: '%',
    description: 'Elongation - 파단 시까지의 변형률'
  },
  {
    key: 'moe',
    name: '탄성계수',
    unit: 'psi',
    description: 'Modulus of Elasticity - 재료의 강성도를 나타내는 계수'
  },
  {
    key: 'pr',
    name: '포아송비',
    unit: '%',
    description: "Poisson's Ratio - 축방향 변형에 대한 횡방향 변형의 비"
  },
  {
    key: 'max_service_temp',
    name: '최대사용온도',
    unit: '°F',
    description: 'Maximum Service Temperature - 재료가 안전하게 사용될 수 있는 최대 온도'
  },
  {
    key: 'coef_thermal_exp',
    name: '열팽창계수',
    unit: 'μin/in',
    description: 'Coefficient of Thermal Expansion - 온도 변화에 따른 길이 변화율'
  }
];

// 재료 카테고리 정보
export interface MaterialCategoryInfo {
  key: string;
  name: string;
  description: string;
  commonGrades: string[];
}

export const MATERIAL_CATEGORIES: MaterialCategoryInfo[] = [
  {
    key: 'aluminum',
    name: '알루미늄',
    description: '경량이면서 내식성이 우수한 비철금속',
    commonGrades: ['AL6061', 'AL6063', 'AL5052', 'AL1100']
  },
  {
    key: 'carbonsteel',
    name: '탄소강',
    description: '철과 탄소의 합금으로 구조용 재료의 기본',
    commonGrades: ['AISI_1020', 'AISI_1045', 'A36', 'A572']
  },
  {
    key: 'stainless',
    name: '스테인리스강',
    description: '크롬을 포함한 내식성 강재',
    commonGrades: ['SUS304', 'SUS316', 'SUS410', 'SUS430']
  },
  {
    key: 'lowalloy',
    name: '저합금강',
    description: '소량의 합금원소를 첨가한 고강도 강재',
    commonGrades: ['4140', '4340', '8620', '9310']
  },
  {
    key: 'nickel',
    name: '니켈합금',
    description: '고온 및 부식 환경에서 사용되는 특수 합금',
    commonGrades: ['Inconel600', 'Inconel625', 'Monel400', 'Hastelloy']
  }
];