/**
 * materialData.ts - 재료 물성 데이터
 * 
 * GitHub KittyCAD/material-properties 저장소의 데이터 구조를 기반으로
 * 샘플 재료 데이터를 정의합니다.
 * 
 * 실제 운영 시에는 GitHub API 또는 정적 파일에서 데이터를 가져올 예정
 */

import { MaterialSelection, MaterialDatabase } from '@/types/materialProperties';

// 알루미늄 합금 데이터
export const ALUMINUM_MATERIALS: MaterialSelection[] = [
  {
    id: 'al6061-t6',
    category: 'aluminum',
    type: 'AL6061',
    grade: 'T6',
    condition: 'heat_treated',
    displayName: 'AL6061-T6',
    properties: {
      den: 0.098, // lb/in³
      yield_str: 40000, // psi
      ult_str: 45000, // psi
      elongation: 12, // %
      moe: 10000000, // psi
      pr: 33, // %
      max_service_temp: 400, // °F
      coef_thermal_exp: 13.1 // µin/in/°F
    }
  },
  {
    id: 'al5052-h32',
    category: 'aluminum',
    type: 'AL5052',
    grade: 'H32',
    condition: 'strain_hardened',
    displayName: 'AL5052-H32',
    properties: {
      den: 0.097,
      yield_str: 28000,
      ult_str: 33000,
      elongation: 12,
      moe: 10200000,
      pr: 33,
      max_service_temp: 400,
      coef_thermal_exp: 13.2
    }
  },
  {
    id: 'al2024-t4',
    category: 'aluminum',
    type: 'AL2024',
    grade: 'T4',
    condition: 'heat_treated',
    displayName: 'AL2024-T4',
    properties: {
      den: 0.100,
      yield_str: 47000,
      ult_str: 68000,
      elongation: 20,
      moe: 10600000,
      pr: 33,
      max_service_temp: 400,
      coef_thermal_exp: 12.9
    }
  },
  {
    id: 'al7075-t6',
    category: 'aluminum',
    type: 'AL7075',
    grade: 'T6',
    condition: 'heat_treated',
    displayName: 'AL7075-T6',
    properties: {
      den: 0.101,
      yield_str: 73000,
      ult_str: 83000,
      elongation: 11,
      moe: 10400000,
      pr: 33,
      max_service_temp: 375,
      coef_thermal_exp: 12.9
    }
  }
];

// 스테인리스강 데이터
export const STAINLESS_MATERIALS: MaterialSelection[] = [
  {
    id: 'sus304',
    category: 'stainless',
    type: 'SUS304',
    grade: '304',
    condition: 'annealed',
    displayName: 'SUS304',
    properties: {
      den: 0.29,
      yield_str: 30000,
      ult_str: 75000,
      elongation: 40,
      moe: 28000000,
      pr: 29,
      max_service_temp: 1500,
      coef_thermal_exp: 9.6
    }
  },
  {
    id: 'sus316',
    category: 'stainless',
    type: 'SUS316',
    grade: '316',
    condition: 'annealed',
    displayName: 'SUS316',
    properties: {
      den: 0.29,
      yield_str: 30000,
      ult_str: 75000,
      elongation: 40,
      moe: 28000000,
      pr: 29,
      max_service_temp: 1600,
      coef_thermal_exp: 9.0
    }
  },
  {
    id: 'sus316l',
    category: 'stainless',
    type: 'SUS316L',
    grade: '316L',
    condition: 'annealed',
    displayName: 'SUS316L',
    properties: {
      den: 0.29,
      yield_str: 25000,
      ult_str: 70000,
      elongation: 40,
      moe: 28000000,
      pr: 29,
      max_service_temp: 1600,
      coef_thermal_exp: 9.0
    }
  },
  {
    id: 'sus321',
    category: 'stainless',
    type: 'SUS321',
    grade: '321',
    condition: 'annealed',
    displayName: 'SUS321',
    properties: {
      den: 0.29,
      yield_str: 30000,
      ult_str: 75000,
      elongation: 40,
      moe: 28000000,
      pr: 29,
      max_service_temp: 1500,
      coef_thermal_exp: 9.6
    }
  }
];

// 탄소강 데이터
export const CARBON_STEEL_MATERIALS: MaterialSelection[] = [
  {
    id: 'aisi1020',
    category: 'carbonsteel',
    type: 'AISI_1020',
    grade: '1020',
    condition: 'hot_rolled',
    displayName: 'AISI 1020',
    properties: {
      den: 0.284,
      yield_str: 30000,
      ult_str: 50000,
      elongation: 25,
      moe: 30000000,
      pr: 26,
      max_service_temp: 800,
      coef_thermal_exp: 6.5
    }
  },
  {
    id: 'aisi1045',
    category: 'carbonsteel',
    type: 'AISI_1045',
    grade: '1045',
    condition: 'hot_rolled',
    displayName: 'AISI 1045',
    properties: {
      den: 0.284,
      yield_str: 45000,
      ult_str: 82000,
      elongation: 16,
      moe: 30000000,
      pr: 26,
      max_service_temp: 800,
      coef_thermal_exp: 6.5
    }
  },
  {
    id: 'aisi1060',
    category: 'carbonsteel',
    type: 'AISI_1060',
    grade: '1060',
    condition: 'hot_rolled',
    displayName: 'AISI 1060',
    properties: {
      den: 0.284,
      yield_str: 54000,
      ult_str: 90000,
      elongation: 12,
      moe: 30000000,
      pr: 26,
      max_service_temp: 800,
      coef_thermal_exp: 6.5
    }
  }
];

// 저합금강 데이터
export const LOW_ALLOY_STEEL_MATERIALS: MaterialSelection[] = [
  {
    id: 'aisi4140',
    category: 'lowalloy',
    type: 'AISI_4140',
    grade: '4140',
    condition: 'quenched_tempered',
    displayName: 'AISI 4140',
    properties: {
      den: 0.284,
      yield_str: 95000,
      ult_str: 120000,
      elongation: 18,
      moe: 30000000,
      pr: 26,
      max_service_temp: 800,
      coef_thermal_exp: 6.5
    }
  },
  {
    id: 'aisi4340',
    category: 'lowalloy',
    type: 'AISI_4340',
    grade: '4340',
    condition: 'quenched_tempered',
    displayName: 'AISI 4340',
    properties: {
      den: 0.284,
      yield_str: 125000,
      ult_str: 145000,
      elongation: 12,
      moe: 30000000,
      pr: 26,
      max_service_temp: 800,
      coef_thermal_exp: 6.5
    }
  }
];

// 니켈 합금 데이터
export const NICKEL_ALLOY_MATERIALS: MaterialSelection[] = [
  {
    id: 'inconel600',
    category: 'nickel',
    type: 'INCONEL_600',
    grade: '600',
    condition: 'annealed',
    displayName: 'Inconel 600',
    properties: {
      den: 0.304,
      yield_str: 35000,
      ult_str: 80000,
      elongation: 30,
      moe: 31000000,
      pr: 31,
      max_service_temp: 2000,
      coef_thermal_exp: 7.4
    }
  },
  {
    id: 'inconel625',
    category: 'nickel',
    type: 'INCONEL_625',
    grade: '625',
    condition: 'annealed',
    displayName: 'Inconel 625',
    properties: {
      den: 0.305,
      yield_str: 60000,
      ult_str: 120000,
      elongation: 30,
      moe: 29800000,
      pr: 31,
      max_service_temp: 1800,
      coef_thermal_exp: 7.1
    }
  },
  {
    id: 'hastelloyc276',
    category: 'nickel',
    type: 'HASTELLOY_C276',
    grade: 'C276',
    condition: 'annealed',
    displayName: 'Hastelloy C-276',
    properties: {
      den: 0.321,
      yield_str: 41000,
      ult_str: 100000,
      elongation: 40,
      moe: 29800000,
      pr: 31,
      max_service_temp: 1900,
      coef_thermal_exp: 6.2
    }
  }
];

// 전체 재료 데이터베이스
export const MATERIAL_DATABASE: MaterialDatabase = {
  aluminum: ALUMINUM_MATERIALS,
  stainless: STAINLESS_MATERIALS,
  carbonsteel: CARBON_STEEL_MATERIALS,
  lowalloy: LOW_ALLOY_STEEL_MATERIALS,
  nickel: NICKEL_ALLOY_MATERIALS
};

// 모든 재료를 하나의 배열로 통합
export const ALL_MATERIALS: MaterialSelection[] = [
  ...ALUMINUM_MATERIALS,
  ...STAINLESS_MATERIALS,
  ...CARBON_STEEL_MATERIALS,
  ...LOW_ALLOY_STEEL_MATERIALS,
  ...NICKEL_ALLOY_MATERIALS
];

// 카테고리별 재료 개수
export const MATERIAL_COUNTS = {
  aluminum: ALUMINUM_MATERIALS.length,
  stainless: STAINLESS_MATERIALS.length,
  carbonsteel: CARBON_STEEL_MATERIALS.length,
  lowalloy: LOW_ALLOY_STEEL_MATERIALS.length,
  nickel: NICKEL_ALLOY_MATERIALS.length,
  total: ALL_MATERIALS.length
};

// 재료 검색 함수
export const searchMaterials = (query: string): MaterialSelection[] => {
  const lowercaseQuery = query.toLowerCase();
  return ALL_MATERIALS.filter(material =>
    material.displayName.toLowerCase().includes(lowercaseQuery) ||
    material.type.toLowerCase().includes(lowercaseQuery) ||
    material.grade.toLowerCase().includes(lowercaseQuery)
  );
};

// 카테고리별 재료 가져오기
export const getMaterialsByCategory = (category: string): MaterialSelection[] => {
  return MATERIAL_DATABASE[category as keyof MaterialDatabase] || [];
};

// ID로 재료 찾기
export const getMaterialById = (id: string): MaterialSelection | undefined => {
  return ALL_MATERIALS.find(material => material.id === id);
};